// ------------------
// State
// ------------------
let recipes = [];
let ingredients = [];
let recipeIngredients = [];

let ingredientById = new Map();
let costByIngredientId = new Map();

let shoppingMap = new Map();

let recipesTable;
let ingredientsTable;
let shoppingTable;

// ------------------
// Fetch data from Flask
// ------------------
fetch("/shopping/load")
  .then(res => res.json())
  .then(data => {
    recipes = data.recipes;
    ingredients = data.ingredients;
    recipeIngredients = data.recipe_ingredients;

    buildLookups();

    renderRecipes();
    renderIngredients();
    updateTable();
  });



// ------------------
// Build lookup maps
// ------------------
function buildLookups() {
  ingredients.forEach(i => {
    ingredientById.set(i.ingredient_id, i.ingredient_name);
    costByIngredientId.set(i.ingredient_id, i.cost_per_unit || 0);
  });
}


// ------------------
// Render recipe list
// ------------------
function renderRecipes() {
  if (recipesTable) {
    recipesTable.replaceData(recipes);
    return;
  }

  recipesTable = new Tabulator("#recipes-table", {
    data: recipes,
    layout: "fitColumns",
    reactiveData: true,
    columns: [
      {
        title: "Recipe",
        field: "name",
        headerFilter: "input"
      },
      {
        title: "Cost ($)",
        hozAlign: "right",
        formatter: cell =>
          calculateRecipeCost(cell.getRow().getData().id).toFixed(2)
      },
      {
        title: "",
        formatter: () => "Add",
        width: 90,
        hozAlign: "center",
        cellClick: (e, cell) => {
          addRecipe(cell.getRow().getData().id);
        }
      }
    ]
  });
}


function renderIngredients() {
  if (ingredientsTable) {
    ingredientsTable.replaceData(ingredients);
    return;
  }

  ingredientsTable = new Tabulator("#ingredients-table", {
    data: ingredients,
    layout: "fitColumns",
    reactiveData: true,
    columns: [
      {
        title: "Ingredient",
        field: "ingredient_name",
        headerFilter: "input"
      },
      {
        title: "Cost / Unit",
        field: "cost_per_unit",
        hozAlign: "right",
        editor: "number",
        cellEdited: cell => {
          const row = cell.getRow().getData();
          costByIngredientId.set(row.ingredient_id, row.cost_per_unit || 0);

          // Refresh recipe costs
          recipesTable.redraw(true);
        }
      }
    ]
  });
}



// ------------------
// Add recipe → shopping map
// ------------------
function addRecipe(recipeId) {
  recipeIngredients
    .filter(ri => ri.recipe_id === recipeId)
    .forEach(ri => {
      const name = ingredientById.get(ri.ingredient_id);

      shoppingMap.set(
        name,
        (shoppingMap.get(name) || 0) + ri.quantity
      );
    });

  updateTable();
}


// ------------------
// Calculate recipe cost
// ------------------
function calculateRecipeCost(recipeId) {
  return recipeIngredients
    .filter(ri => ri.recipe_id === recipeId)
    .reduce((total, ri) => {
      const cost = costByIngredientId.get(ri.ingredient_id) || 0;
      return total + cost * ri.quantity;
    }, 0);
}


// ------------------
// Initialize / update Tabulator table
// ------------------
function updateTable() {
  const data = Array.from(shoppingMap, ([ingredient, quantity]) => ({
    ingredient,
    quantity
  }));

  if (!shoppingTable) {
    shoppingTable = new Tabulator("#shopping-table", {
      data,
      layout: "fitColumns",
      reactiveData: true,
      columns: [
        {
          title: "Ingredient",
          field: "ingredient",
          headerFilter: "input"
        },
        {
          title: "Quantity",
          field: "quantity",
          hozAlign: "right",
          editor: "number"
        }
      ]
    });
  } else {
    shoppingTable.replaceData(data);
  }
}



// ------------------
// Save shopping list to Flask
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
