from flask import Blueprint, render_template, request, flash, redirect, url_for
from .queue_system import print_queue   # <- your queue file
from .printer import test_print         # <- if you still use test print
from PIL import Image
import io

print_bp = Blueprint(
    "print",
    __name__,
    url_prefix="/print",
    template_folder="templates"
)


@print_bp.route("/", methods=["GET"])
def print_index():
    return render_template("print.html")


@print_bp.route("/test", methods=["POST"])
def run_test_print():
    try:
        test_print()
        flash("Test print sent!", "success")
    except Exception as e:
        flash(f"Test print failed: {e}", "error")

    return redirect(url_for("print.print_index"))


@print_bp.route("/", methods=["POST"])
def upload_and_print():
    if "image" not in request.files:
        flash("No image uploaded.", "error")
        return redirect(url_for("print.print_index"))

    file = request.files["image"]

    if file.filename == "":
        flash("No image selected.", "error")
        return redirect(url_for("print.print_index"))

    try:
        # Read file into a PIL image
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))

        # Add image to the queue
        print_queue.put(image)

        flash("Image added to print queue!", "success")

    except Exception as e:
        flash(f"Failed to queue print job: {e}", "error")

    return redirect(url_for("print.print_index"))
