from flask import Flask, render_template, redirect, url_for

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/status")
def status():
    return {"status": "ok", "message": "Flask is running on the Pi"}

# Example route you'll customize later
@app.route("/shopping")
def shopping():
    items = ["Milk", "Bread", "Eggs"]
    return render_template("shopping.html", items=items)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
