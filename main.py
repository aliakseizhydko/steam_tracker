import requests, os, random, json
from flask import Flask, render_template, jsonify, request
from models import db, PlayedGame, GameSnapshot, Friend, DailyStat, PushSubscription
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from pywebpush import webpush, WebPushException

app = Flask(__name__)

load_dotenv()
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

STEAM_API_KEY = os.getenv("STEAM_API_KEY")
STEAM_ID = os.getenv("STEAM_ID")

db.init_app(app)

@app.cli.command("init-db")
def init_db_command():
    with app.app_context():
        db.create_all()   

@app.route('/')
def home():
    url = "http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/"
    params = {
        "key": STEAM_API_KEY,
        "steamid": STEAM_ID,
        "format": "json"
    }
    response = requests.get(url, params=params)
    games = response.json().get("response", {}).get("games", [])
    return render_template("index.html", games=games, vapid_public_key=os.getenv("VAPID_PUBLIC_KEY"))

def save_games_to_db(games_list):
    saved = 0
    updated = 0
    deleted = 0
    
    current_games = [g.get("name") for g in games_list if g.get("name")]
    old_games = PlayedGame.query.filter(~PlayedGame.name.in_(current_games)).all()
    
    for game in old_games:
        GameSnapshot.query.filter_by(game_id=game.id).delete()
        db.session.delete(game)
        deleted += 1
    
    for g in games_list:
        name = g.get("name")
        playtime_2weeks = g.get("playtime_2weeks", 0)
        playtime_forever = g.get("playtime_forever", 0)
        
        game = PlayedGame.query.filter_by(name=name).first()
        if game is None:
            new_game = PlayedGame(
                name=name,
                play_time_2weeks=playtime_2weeks,
                playtime_forever=playtime_forever
            )
            db.session.add(new_game)
            saved += 1
        else:
            game.play_time_2weeks = playtime_2weeks
            game.playtime_forever = playtime_forever
            updated += 1
    
    # ???????
    # db.session.commit()
    
    for g in games_list:
        name = g.get("name")
        game = PlayedGame.query.filter_by(name=name).first()
        if game:
            snapshot = GameSnapshot(
                game_id=game.id,
                playtime_forever=game.playtime_forever
            )
            db.session.add(snapshot)
            
    db.session.commit()
    return {"saved": saved, "updated": updated, "deleted": deleted}

@app.route('/save_recent')
def save_recent():
    url = "http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/"
    params = {
        "key": STEAM_API_KEY,
        "steamid": STEAM_ID,
        "format": "json"
    }
    r = requests.get(url, params=params)  
    data = r.json().get("response", {})
    games = data.get("games", []) 
    
    result = save_games_to_db(games)
    return jsonify(result)

@app.route('/games')
def show_games():
    games = PlayedGame.query.order_by(PlayedGame.id.desc()).all()
    return render_template("games.html", games=games)

def update_daily_stat():
    today = datetime.utcnow().date()
    yesterday = today - timedelta(days=1)
    
    start = datetime.combine(yesterday, datetime.min.time())
    end = datetime.combine(today, datetime.min.time())
    
    snapshots = GameSnapshot.query.filter(GameSnapshot.create_at >= start,
                                          GameSnapshot.create_at < end).all()
    
    if not snapshots:
        print('DAAAAAAMN! Really? Did you live a fully real life yesterday?')
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
    
    if total_hours > 2:
        phrases = [
            f"Come on! {total_hours}h! Really? Go touch the grass today!",
            f"{total_hours}h! You can't live yesterday again",
            f"If you spent {total_hours} hours every day learning programming, you would have been on the Forbes list a long time ago."
        ]
    else:
        phrases = [
            f"{total_hours}h! I hope yesterday was a really great day!",
            f"Just {total_hours}h. Life really is beautiful, isn't it?",
            f"Well... {total_hours}h. This is truly a success."
        ]
        
    message = random.choice(phrases)
    
    # Need check later
    if total_minutes > 0:
        send_push("Push is here!", stat.message)
    
    stat = DailyStat(date=yesterday, total_minutes=int(total_minutes), message=message)
    db.session.merge(stat)
    db.session.commit()
    print(message)   

def scheduled_update():
    with app.app_context():
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting automatic updates...")
        try:
            url = "http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/"
            params = {
                "key": STEAM_API_KEY,
                "steamid": STEAM_ID,
                "format": "json"
            }
            r = requests.get(url, params=params)  
            data = r.json().get("response", {})
            games = data.get("games", [])
            
            result = save_games_to_db(games)
            print(f"Updated: {result}")
        except Exception as e:
            db.session.rollback()
            print(f"That was fuck up: {e}")
            
scheduler = BackgroundScheduler()

scheduler.add_job(
    func=scheduled_update,
    trigger="interval",
    minutes=60,
    id="steam_update",
    replace_existing=True
)

scheduler.add_job(
    func=update_daily_stat,
    trigger="cron",
    hour=0, minute=5,
    id="daily_stat_job",
    replace_existing=True
)

def update_friends():
    url = "http://api.steampowered.com/ISteamUser/GetFriendList/v0001/"
    params = {
        "key": STEAM_API_KEY,
        "steamid": STEAM_ID,
        "relationship": "friend"
    }
    r = requests.get(url, params=params)
    friends_data = r.json().get("friendslist", {}).get("friends", [])
    
    count = 0
    for f in friends_data:
        friend_id = f["steamid"]
        info_url = "http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/"
        info_params = {"key": STEAM_API_KEY, "steamids": friend_id}
        info_r = requests.get(info_url, params=info_params)
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

@app.route('/update_friends')
def update_friends_route():
    result = update_friends()
    return result

@app.route('/dashboard')
def dashboard():
    update_daily_stat()
    # Statistics for the week
    weeak_ago = datetime.utcnow() - timedelta(days=7)
    snapshots = GameSnapshot.query.filter(GameSnapshot.create_at >= weeak_ago).all()
    
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
            
    stats_data = []
    for name, times in stats_dict.items():
        delta_minutes = times["end"] - times["start"]
        delta_hours = round(delta_minutes / 60, 1)
        if delta_hours > 0:
            stats_data.append({"name": name, "hours": delta_hours})
    stats_data.sort(key=lambda x: x["hours"], reverse=True)   
    
    # Comparison with friends
    my_url = "http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/"
    my_params = {
        "key": STEAM_API_KEY,
        "steamid": STEAM_ID,
        "format": "json"
    }
    my_r = requests.get(my_url, params=my_params)
    my_games = my_r.json().get("response", {}).get("games", [])
    my_total = sum(g.get("playtime_2weeks", 0) for g in my_games) / 60
    
    friends = Friend.query.all()
    comparisons = []
    for friend in friends:
        url = "http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/"
        params = {
            "key": STEAM_API_KEY,
            "steamid": friend.steamid,
            "format": "json"
        }
        r = requests.get(url, params=params)
        data = r.json().get("response", {}).get("games", [])
        total = sum(g.get("playtime_2weeks", 0) for g in data) / 60
        diff = round(my_total - total, 1)
        comparisons.append({
            "name": friend.personaname,
            "avatar": friend.avatar,
            "friend_hours": round(total, 1),
            "diff": diff
        })
    comparisons.sort(key=lambda x: x["friend_hours"], reverse=True)
    
    labels = [row["name"] for row in stats_data]
    values = [row["hours"] for row in stats_data]
    
    return render_template("dashboard.html", stats=stats_data, labels=labels, values=values, me=my_total, comparisons=comparisons)

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

def send_push(title, body):
    subscriptions = PushSubscription.query.all()
    if not subscriptions:
        print("No push subscriptions :(")
        return
    
    payload = json.dumps({
        "title": title,
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

if __name__ == "__main__":
    if os.getenv("RUN_SCHEDULER", "false").lower() in ("1", "true", "yes"):
        scheduler.start()
        print("Scheduler enabled")
        
    app.run(
            host="0.0.0.0",
            port=int(os.getenv("PORT", 5000)),
            debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
            threaded=True,
            use_reloader=False)