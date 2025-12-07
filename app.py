from flask import Flask
from blueprints.home.routes import home_bp
from blueprints.print.routes import print_bp
from printer import start_worker, stop_worker
import os, atexit

def create_app():
    app = Flask(__name__)
    atexit.register(stop_worker)

    start_worker()

    # Register your blueprints
    app.register_blueprint(home_bp)
    app.register_blueprint(print_bp)

    # Set maximum upload size to 32 MB
    app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32 MB

    return app

# Gunicorn looks for a variable named "app"
app = create_app()
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key")

if __name__ == "__main__":
    # For development only (not used with gunicorn)
    app.run(host="0.0.0.0", port=5000, debug=True)
