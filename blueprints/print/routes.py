from flask import Blueprint, render_template, request, flash, redirect, url_for
import printer

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