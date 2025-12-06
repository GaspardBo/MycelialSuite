from flask import Blueprint

print_bp = Blueprint(
    "print",
    __name__,
    template_folder="templates"
)

from . import routes
