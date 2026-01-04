let recipes = [];
let shoppingMap = new Map();
let table;

// ------------------
// Fetch recipes
// ------------------
fetch("/shopping/recipes")
  .then(res => res.json())
  .then(data => {
    recipes = data;
    renderRecipes();
  });

// ------------------
// Render recipe list
// ------------------
function renderRecipes() {
  const ul = document.getElementById("recipe-list");

  recipes.forEach(recipe => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${recipe.name}</strong>
      <button>Add</button>
    `;
    li.querySelector("button").onclick = () => addRecipe(recipe);
    ul.appendChild(li);
  });
}

// ------------------
// Add recipe → map
// ------------------
function addRecipe(recipe) {
  recipe.ingredients.split(";").forEach(ingredient => {
    ingredient = ingredient.trim();
    shoppingMap.set(
      ingredient,
      (shoppingMap.get(ingredient) || 0) + 1
    );
  });

  updateTable();
}

// ------------------
// Initialize / update table
// ------------------
function updateTable() {
  const data = Array.from(shoppingMap, ([ingredient, quantity]) => ({
    ingredient,
    quantity
  }));

  if (!table) {
    table = new Tabulator("#shopping-table", {
      data,
      layout: "fitColumns",
      reactiveData: true,
      columns: [
        {
          title: "Ingredient",
          field: "ingredient",
          editor: "input",
          headerFilter: "input"
        },
        {
          title: "Quantity",
          field: "quantity",
          editor: "number",
          hozAlign: "right"
        }
      ]
    });
  } else {
    table.replaceData(data);
  }
}

// ------------------
// Save to Flask
// ------------------
document.getElementById("save-btn").onclick = () => {
  fetch("/shopping/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(table.getData())
  })
  .then(res => res.json())
  .then(() => alert("Saved!"));
};
