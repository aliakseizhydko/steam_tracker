from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class PlayedGame(db.Model):
    __tablename__ = 'played_games'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    play_time_2weeks = db.Column(db.Integer)
    playtime_forever = db.Column(db.Integer)
    
    snapshots = db.relationship("GameSnapshot", backref="game", lazy=True)
    
    def __repr__(self):
        return f"<Game {self.name}>"
    
class GameSnapshot(db.Model):
    __tablename__ = 'game_snapshots'
    
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey('played_games.id', ondelete="RESTRICT"), nullable=False)
    playtime_forever = db.Column(db.Integer, default=0)
    create_at = db.Column(db.DateTime, default=datetime.utcnow)

class Friend(db.Model):
    __tablename__ = 'friends'
    id = db.Column(db.Integer, primary_key=True)
    steamid = db.Column(db.String(50), unique=True, nullable=False)
    personaname = db.Column(db.String(100), nullable=False)
    avatar = db.Column(db.String(255), nullable=True)
    
class DailyStat(db.Model):
    __tablename__ = 'daily_stats'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, unique=True, nullable=False)
    total_minutes = db.Column(db.Integer, default=0)
    message = db.Column(db.String(255))
    
    def __repr__(self):
        return f"<DailyStat {self.date} - {self.total_minutes} min>"
    
class PushSubscription(db.Model):
    __tablename__ = 'push_subscriptions'
    
    id = db.Column(db.Integer, primary_key=True)
    endpoint = db.Column(db.Text, nullable=False)
    p256dh = db.Column(db.Text, nullable=False)
    auth = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<PushSub {self.endpoint[:50]}...>"