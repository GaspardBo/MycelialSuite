from flask import Blueprint, render_template, request, flash, redirect, url_for
from PIL import Image
import print.printer, io

print_bp = Blueprint(
    "print",
    __name__,
    url_prefix="/print",
    template_folder="templates"
)

@print_bp.route("/")
def print_index():
    return render_template("print.html")

@print_bp.route("/run_test_print", methods=["POST"])
def run_test_print():
    try:
        printer.test_print()
        flash("Printed successfully!", "success")
    except Exception as e:
        flash(f"Print failed: {e}", "error")
    return redirect(url_for("print.print_index"))

@print_bp.route("/upload", methods=["POST"])
def upload_and_print():
    file = request.files.get("image")

    if not file:
        flash("No file uploaded!")
        return redirect(request.url)

    # Open image using PIL
    image = Image.open(file.stream)

    # Call your printer script
    try:
        printer.print_image(image)
        flash("Image sent to printer!")
    except Exception as e:
        flash(f"Printing failed: {e}")

    return redirect("/print")