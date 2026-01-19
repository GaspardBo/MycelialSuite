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

@shopping_bp.route('/recipe_ingredients/update', methods=['POST'])
def update_recipe_ingredients():
    try:
        data = request.json
        recipe_id = data['recipe_id']
        ingredients = data['ingredients']
        
        base_dir = os.path.dirname(os.path.abspath(__file__))
        recipe_ingredients_path = os.path.join(base_dir, "data", "recipe_ingredients.csv")
        
        # Load existing recipe ingredients
        recipe_ingredients_df = pd.read_csv(recipe_ingredients_path)
        
        # Remove old ingredients for this recipe
        recipe_ingredients_df = recipe_ingredients_df[recipe_ingredients_df['recipe_id'] != recipe_id]
        
        # Add new ingredients for this recipe
        new_ingredients_df = pd.DataFrame(ingredients)
        recipe_ingredients_df = pd.concat([recipe_ingredients_df, new_ingredients_df], ignore_index=True)
        
        # Save to CSV
        recipe_ingredients_df.to_csv(recipe_ingredients_path, index=False)
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500