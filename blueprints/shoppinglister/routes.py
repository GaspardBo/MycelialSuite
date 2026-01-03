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
    #load dataframe
    app = Flask(__name__)
    csv_path = os.path.join(app.static_folder, "recipes.csv")
    df = pd.read_csv(csv_path)

    # Convert DataFrame to HTML
    table_html = df.to_html(
        classes="table table-striped",
        index=False
    )

    return render_template(
        "shopping.html",
       data=recipes_df.to_dict(orient="records")
    )

@shopping_bp.route("/save", methods=["POST"])
def save():
    data = request.json
    pd.DataFrame(data).to_csv("data.csv", index=False)
    return {"status": "ok"}


