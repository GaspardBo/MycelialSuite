from flask import Blueprint, render_template, request, Flask
import pandas as pd
import os

shopping_bp = Blueprint(
    "shopping",
    __name__,
    url_prefix="/shopping",
    template_folder="templates"
)


@shopping_bp.route("/", methods=["GET"])
def shopping_index():
    return render_template("shopping.html")

@shopping_bp.route("/save", methods=["POST"])
def save():
    data = request.json
    pd.DataFrame(data).to_csv("data.csv", index=False)
    return {"status": "ok"}

@shopping_bp.route("/recipes", methods=["GET"])
def get_recipes():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "data", "recipes.csv")

    df = pd.read_csv(csv_path)
    return df.to_dict(orient="records")

