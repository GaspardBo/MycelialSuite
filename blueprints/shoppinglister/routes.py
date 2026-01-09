from flask import Blueprint, render_template, request, Flask, jsonify
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

@shopping_bp.route("/load", methods=["GET"])
def get_data():
    base_dir = os.path.dirname(os.path.abspath(__file__))

    recipes = pd.read_csv(os.path.join(base_dir, "data", "recipes.csv"))
    ingredients = pd.read_csv(os.path.join(base_dir, "data", "ingredients.csv"))
    recipe_ingredients = pd.read_csv(os.path.join(base_dir, "data", "recipe_ingredients.csv"))

    return jsonify({
        "recipes": recipes.to_dict(orient="records"),
        "ingredients": ingredients.to_dict(orient="records"),
        "recipe_ingredients": recipe_ingredients.to_dict(orient="records")
    })

