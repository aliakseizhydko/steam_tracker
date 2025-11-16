from main import app, scheduler, scheduled_update
import time

if __name__ == "__main__":
    with app.app_context():
        print("Starting worker + scheduler...")
        scheduler.start()
        
        print("Running initial scheduled_update job manually...")
        scheduled_update()
        
        try:
            while True:
                time.sleep(60)
        except (KeyboardInterrupt, SystemExit):
            scheduler.shutdown()