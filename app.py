from flask import Flask
from blueprints.home.routes import home_bp
from blueprints.print.routes import print_bp
import os

def create_app():
    app = Flask(__name__)

    # Register your blueprints
    app.register_blueprint(home_bp)
    app.register_blueprint(print_bp)

    return app

# Gunicorn looks for a variable named "app"
app = create_app()
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key")

if __name__ == "__main__":
    # For development only (not used with gunicorn)
    app.run(host="0.0.0.0", port=5000, debug=True)
