import requests, os, random, json, time
from flask import Flask, render_template, jsonify, request
from models import db, PlayedGame, GameSnapshot, Friend, DailyStat, PushSubscription
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from pywebpush import webpush, WebPushException
from collections import defaultdict
from sqlalchemy import func, and_, asc
from functools import lru_cache

app = Flask(__name__)

load_dotenv()
app.config.update(
    SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL"),
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
)

STEAM_API_KEY = os.getenv("STEAM_API_KEY")
STEAM_ID = os.getenv("STEAM_ID")
STEAM_BASE = "http://api.steampowered.com/"
STEAM_RECENTLY_PLAYED_GAMES = f"{STEAM_BASE}IPlayerService/GetRecentlyPlayedGames/v0001/"
STEAM_FRIEND_LIST = f"{STEAM_BASE}ISteamUser/GetFriendList/v0001/"
STEAM_PLAYER_SUMMARIES = f"{STEAM_BASE}ISteamUser/GetPlayerSummaries/v0002/"

db.init_app(app)

@app.cli.command("init-db")
def init_db_command():
    with app.app_context():
        db.create_all()         

def save_games_to_db(games_list):
    saved, updated, deleted = 0, 0, 0
    
    current_games = [g.get("name") for g in games_list if g.get("name")]
    old_games = PlayedGame.query.filter(~PlayedGame.name.in_(current_games)).all()
    
    phrases_for_deleted = [
        "\"{}\" has dropped out of the recent",
        "\"{}\" did not start for more than two weeks",
        "Goodbye, \"{}\""
    ]
    
    phrases_for_saved = [
        "You started playing \"{}\"",
        "Welcome aboard, \"{}\"",
        "\"{}\" added to statistics"
    ]
    
    for game in old_games:
        name = game.name
        GameSnapshot.query.filter_by(game_id=game.id).delete(synchronize_session='fetch')
        db.session.delete(game)
        deleted += 1
        
        message = random.choice(phrases_for_deleted).format(name)
        send_push(message)
    
    snapshots_to_add = []
    game_map = {}
    
    for g in games_list:
        name = g.get("name")
        
        if not name:
            continue
        
        playtime_2weeks = g.get("playtime_2weeks", 0)
        playtime_forever = g.get("playtime_forever", 0)
        
        game = PlayedGame.query.filter_by(name=name).first()
        
        if game is None:
            game = PlayedGame(
                name=name,
                play_time_2weeks=playtime_2weeks,
                playtime_forever=playtime_forever
            )
            db.session.add(game)
            saved += 1
            
            message = random.choice(phrases_for_saved).format(name)
            send_push(message)
        else:
            game.play_time_2weeks = playtime_2weeks
            game.playtime_forever = playtime_forever
            updated += 1
        
        game_map[name] = game
    
    db.session.flush()

    for name, game in game_map.items():
        if not game.id:
            continue
        
        last_snapshot = (
            GameSnapshot.query
            .filter_by(game_id=game.id)
            .order_by(GameSnapshot.create_at.desc())
            .first()
        )
        # There is a debug
        # print(f"{name} == {game}")
        # print(last_snapshot)
        if not last_snapshot or last_snapshot.playtime_forever != game.playtime_forever:
            snapshot = GameSnapshot(
                game_id=game.id,
                playtime_forever=game.playtime_forever
            )
            snapshots_to_add.append(snapshot)
            
    if snapshots_to_add:
        db.session.bulk_save_objects(snapshots_to_add)
    
    # Remove old snapshots    
    non_actual_snapshots = datetime.utcnow() - timedelta(days=8)
    deleted_count = GameSnapshot.query.filter(
        GameSnapshot.create_at < non_actual_snapshots
    ).delete(synchronize_session='fetch')
            
    db.session.commit()
    return {"saved": saved, "updated": updated, "deleted": deleted}

def update_daily_stat():
    with app.app_context():
        today = datetime.utcnow().date()
        yesterday = today - timedelta(days=1)
        
        start = datetime.combine(yesterday, datetime.min.time())
        end = datetime.combine(today, datetime.min.time())
        
        snapshots = GameSnapshot.query.filter(
                GameSnapshot.create_at >= start,
                GameSnapshot.create_at < end
            ).order_by(asc(GameSnapshot.create_at)).all()
        
        if not snapshots:
            print(f"No snapshots from {start} to {end}")
            return
        
        stats_dict = {}
        for snap in snapshots:
            game = PlayedGame.query.get(snap.game_id)
            if not game:
                continue
            name = game.name
            if name not in stats_dict:
                stats_dict[name] = {"start": snap.playtime_forever, "end": snap.playtime_forever}
            else:
                stats_dict[name]["end"] = snap.playtime_forever
                
        total_minutes = sum(v["end"] - v["start"] for v in stats_dict.values())
        total_hours = round(total_minutes / 60, 1)
        
        phrases = (
                    [
                        f"Come on! {total_hours}h! Really? Go touch the grass today!",
                        f"{total_hours}h! You can't live yesterday again",
                        f"If you spent {total_hours} hours every day learning programming, you would have been on the Forbes list a long time ago."
                    ]
                    if total_hours > 2 else
                    [
                        f"{total_hours}h! I hope yesterday was a really great day!",
                        f"Just {total_hours}h. Life really is beautiful, isn't it?",
                        f"Well... {total_hours}h. This is truly a success."
                    ]
                )
            
        message = random.choice(phrases)
        
        if total_minutes > 0:
            send_push(message)
        else:
            send_push("0h! Need to fix a bug.")
        
        stat = DailyStat(date=yesterday, total_minutes=int(total_minutes), message=message)
        db.session.merge(stat)
        db.session.commit()
        print(message)   

def scheduled_update():
    with app.app_context():
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting automatic updates...")
        try:
            params = {
                "key": STEAM_API_KEY,
                "steamid": STEAM_ID,
                "format": "json"
            }
            r = requests.get(STEAM_RECENTLY_PLAYED_GAMES, params=params)  
            data = r.json().get("response", {})
            games = data.get("games", [])
            
            result = save_games_to_db(games)
            print(f"Updated: {result}")
        except Exception as e:
            db.session.rollback()
            print(f"That was fuck up: {e}")
            
def update_friends():
    params = {
        "key": STEAM_API_KEY,
        "steamid": STEAM_ID,
        "relationship": "friend"
    }
    r = requests.get(STEAM_FRIEND_LIST, params=params)
    friends_data = r.json().get("friendslist", {}).get("friends", [])
    
    count = 0
    for f in friends_data:
        friend_id = f["steamid"]
        info_params = {"key": STEAM_API_KEY, "steamids": friend_id}
        info_r = requests.get(STEAM_PLAYER_SUMMARIES, params=info_params)
        player = info_r.json().get("response", {}).get("players", [])
        
        if not player:
            continue
        
        name = player[0].get("personaname", "Unknown")
        avatar = player[0].get("avatar", "")
        
        existing = Friend.query.filter_by(steamid=friend_id).first()
        if existing:
            existing.personaname = name
            existing.avatar = avatar
        else:
            db.session.add(Friend(steamid=friend_id, personaname=name, avatar=avatar))
        count += 1
        
    db.session.commit()
    return f"Updated {count} friends"

def get_steam_playtime(steamid):
    cache_key_time = int(time.time() // 600) * 600
    return _fetch_steam_playtime_cached(steamid, cache_key_time)

def send_push(body):
    subscriptions = PushSubscription.query.all()
    if not subscriptions:
        print("No push subscriptions :(")
        return
    
    payload = json.dumps({
        "body": body,
        "icon": "/static/pics/icon0.png"
    })
    
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth
                    }
                },
                data=payload,
                vapid_private_key=os.getenv("VAPID_PRIVATE_KEY"),
                vapid_claims={
                    "sub": f"mailto:{os.getenv('VAPID_ADMIN_EMAIL')}"
                }
            )
            print(f"Push sent to {sub.endpoint[:60]}...")
        except WebPushException as e:
            print(f"Push failed: {e}")

@app.route('/')
def home():
    params = {
        "key": STEAM_API_KEY,
        "steamid": STEAM_ID,
        "format": "json"
    }
    response = requests.get(STEAM_RECENTLY_PLAYED_GAMES, params=params)
    games = response.json().get("response", {}).get("games", [])
    return render_template("index.html", games=games, vapid_public_key=os.getenv("VAPID_PUBLIC_KEY"))

@app.route('/save_recent')
def save_recent():
    params = {
        "key": STEAM_API_KEY,
        "steamid": STEAM_ID,
        "format": "json"
    }
    r = requests.get(STEAM_RECENTLY_PLAYED_GAMES, params=params)  
    data = r.json().get("response", {})
    games = data.get("games", []) 
    
    result = save_games_to_db(games)
    return jsonify(result)

@app.route('/games')
def show_games():
    games = PlayedGame.query.order_by(PlayedGame.id.desc()).all()
    return render_template("games.html", games=games)
            
scheduler = BackgroundScheduler()

scheduler.add_job(
    func=scheduled_update,
    trigger="interval",
    minutes=45,
    id="steam_update",
    replace_existing=True
)

scheduler.add_job(
    func=update_daily_stat,
    trigger="cron",
    hour=6, minute=40,
    id="daily_stat_job",
    replace_existing=True
)

@app.route('/update_friends')
def update_friends_route():
    result = update_friends()
    return result

@lru_cache(maxsize=128)
def _fetch_steam_playtime_cached(steamid, timestamp):
    params = {
        "key": STEAM_API_KEY,
        "steamid": steamid,
        "format": "json"
    }
    try:
        r = requests.get(STEAM_RECENTLY_PLAYED_GAMES, params=params, timeout=10)
        r.raise_for_status()
        games = r.json().get("response", {}).get("games", [])
        return sum(g.get("playtime_2weeks", 0) for g in games) / 60
    except:
        return 0.0

@app.route('/dashboard')
def dashboard():
    week_ago = datetime.utcnow() - timedelta(days=7)
    
    snapshots = (
            db.session.query(
                GameSnapshot.game_id,
                func.min(GameSnapshot.playtime_forever).label('min_pt'),
                func.max(GameSnapshot.playtime_forever).label('max_pt'),
                PlayedGame.name
            )
            .join(PlayedGame, GameSnapshot.game_id == PlayedGame.id)
            .filter(GameSnapshot.create_at >= week_ago)
            .group_by(GameSnapshot.game_id, PlayedGame.name)
            .all()
        )
    

    stats_data = []
    for _, min_pt, max_pt, name in snapshots:
        hours = round((max_pt - min_pt) / 60, 1)
        if hours >= 0.1:
            stats_data.append({"name": name, "hours": hours})

    stats_data.sort(key=lambda x: x["hours"], reverse=True)

    labels = [row["name"] for row in stats_data]
    values = [row["hours"] for row in stats_data]

    my_total = get_steam_playtime(STEAM_ID)
    friends = Friend.query.with_entities(Friend.steamid, Friend.personaname, Friend.avatar).all()

    comparisons = []
    for friend in friends:
        friend_hours = get_steam_playtime(friend.steamid)
        diff = round(my_total - friend_hours, 1)
        comparisons.append({
            "name": friend.personaname,
            "avatar": friend.avatar,
            "friend_hours": round(friend_hours, 1),
            "diff": diff
        })
    
    comparisons.sort(key=lambda x: x["friend_hours"], reverse=True)

    return render_template(
        "dashboard.html",
        stats=stats_data,
        labels=labels,
        values=values,
        me=round(my_total, 1),
        comparisons=comparisons
    )

@app.route('/subscribe', methods=['POST'])
def subscribe():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data"}), 400
    
    endpoint = data.get('endpoint')
    p256dh = data.get('keys', {}).get('p256dh')
    auth = data.get('keys', {}).get('auth')
    
    if not all([endpoint, p256dh, auth]):
        return jsonify({"error": "Missing keys"}), 400
    
    existing = PushSubscription.query.filter_by(endpoint=endpoint).first()
    if existing:
        return jsonify({"status": "already_exists"})

    sub = PushSubscription(endpoint=endpoint, p256dh=p256dh, auth=auth)
    db.session.add(sub)
    db.session.commit()
    
    return jsonify({"status": "subscripted"})

@app.route('/unsubscribe', methods=['POST'])
def unsubscribe():
    data = request.get_json()
    endpoint = data.get('endpoint')
    if not endpoint:
        return jsonify({"error": "No endpoint"}), 400
    
    deleted = PushSubscription.query.filter_by(endpoint=endpoint).delete()
    db.session.commit()
    
    return jsonify({"status": "unsubscribed", "deleted": deleted})
            
if os.getenv("RUN_SCHEDULER", "false").lower() in ("1", "true", "yes"):
    scheduler.start()
    print("Scheduler enabled")

if __name__ == "__main__":
        
    app.run(
            host="0.0.0.0",
            port=int(os.getenv("PORT", 5000)),
            debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
            threaded=True,
            use_reloader=False
            )