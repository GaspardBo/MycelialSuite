from flask import Blueprint, render_template, request, Flask, jsonify
from printer import print_text
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

@shopping_bp.route('/recipes/update', methods=['POST'])
def update_recipes():
    try:
        data = request.json
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Check if this is a recipe ingredients update (has recipe_id and ingredients)
        if 'recipe_id' in data and 'ingredients' in data:
            # Update recipe ingredients only
            recipe_id = data['recipe_id']
            ingredients = data['ingredients']
            
            recipe_ingredients_path = os.path.join(base_dir, "data", "recipe_ingredients.csv")
            recipe_ingredients_df = pd.read_csv(recipe_ingredients_path)
            
            # Remove old ingredients for this recipe
            recipe_ingredients_df = recipe_ingredients_df[recipe_ingredients_df['recipe_id'] != recipe_id]
            
            # Add new ingredients for this recipe
            if ingredients:
                new_ingredients_df = pd.DataFrame(ingredients)
                recipe_ingredients_df = pd.concat([recipe_ingredients_df, new_ingredients_df], ignore_index=True)
            
            # Save to CSV
            recipe_ingredients_df.to_csv(recipe_ingredients_path, index=False)
        else:
            # Update recipes
            recipes = data if isinstance(data, list) else [data]
            recipes_path = os.path.join(base_dir, "data", "recipes.csv")
            
            # Convert to DataFrame and save
            recipes_df = pd.DataFrame(recipes)
            recipes_df.to_csv(recipes_path, index=False)
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@shopping_bp.route('/ingredients/update', methods=['POST'])
def update_ingredients():
    try:
        ingredients = request.json
        
        base_dir = os.path.dirname(os.path.abspath(__file__))
        ingredients_path = os.path.join(base_dir, "data", "ingredients.csv")
        
        # Convert to DataFrame and save
        ingredients_df = pd.DataFrame(ingredients)
        ingredients_df.to_csv(ingredients_path, index=False)
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    
@shopping_bp.route('/print', methods=['POST'])
def print_shopping_list():
    try:
        shopping_list = request.json.get('shopping_list', [])
        
        # Format the shopping list for printing
        text_lines = ["SHOPPING LIST", "=" * 40, ""]
        
        for item in shopping_list:
            ingredient = item.get('ingredient', '')
            quantity = item.get('quantity', 0)
            text_lines.append(f"{ingredient}: {quantity}")
        
        text_lines.append("")
        text_lines.append("=" * 40)
        
        # Join all lines with newlines
        text_to_print = "\n".join(text_lines)
        
        # Send to printer
        print_text(text_to_print)
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500