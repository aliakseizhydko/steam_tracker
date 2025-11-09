from main import app, scheduler
import time

if __name__ == "__main__":
    with app.app_context():
        print("Starting worker + scgeduler...")
        scheduler.start()
        try:
            while True:
                time.sleep(60)
        except (KeyboardInterrupt, SystemExit):
            scheduler.shutdown()