// ====================
// STATE MANAGEMENT
// ====================

const state = {
  recipes: [],
  ingredients: [],
  recipeIngredients: [],
  selectedRecipes: [],
  manualIngredients: [], // NEW: Manually added ingredients
  
  // Lookup maps for quick access
  ingredientById: new Map(),
  costByIngredientId: new Map(),
  
  // Tabulator instances
  tables: {
    recipes: null,
    ingredients: null,
    selectedRecipes: null,
    shopping: null,
    ingredientEditor: null // NEW: For the modal editor
  },
  
  // Current recipe being edited
  editingRecipe: null
};


// ====================
// INITIALIZATION
// ====================

async function initialize() {
  try {
    const response = await fetch("/shopping/load");
    const data = await response.json();
    
    state.recipes = data.recipes;
    state.ingredients = data.ingredients;
    state.recipeIngredients = data.recipe_ingredients;
    
    buildIngredientLookups();
    initializeTables();
  } catch (error) {
    console.error("Failed to load data:", error);
  }
}

function buildIngredientLookups() {
  state.ingredients.forEach(ingredient => {
    state.ingredientById.set(ingredient.ingredient_id, ingredient.ingredient_name);
    state.costByIngredientId.set(ingredient.ingredient_id, ingredient.cost_per_unit || 0);
  });
}

function initializeTables() {
  initializeRecipesTable();
  initializeIngredientsTable();
  initializeSelectedRecipesTable();
  initializeShoppingTable();
}


// ====================
// RECIPES TABLE
// ====================

function initializeRecipesTable() {
  state.tables.recipes = new Tabulator("#recipes-table", {
    data: state.recipes,
    layout: "fitColumns",
    reactiveData: true,
    columns: [
      {
        title: "Recipe",
        field: "name",
        headerFilter: "input",
        editor: "input"
      },
      {
        title: "Category",
        field: "category",
        editor: "input",
        width: 120
      },
      {
        title: "Prep Time (min)",
        field: "prep_time_minutes",
        hozAlign: "right",
        editor: "number",
        width: 130
      },
      {
        title: "Servings",
        field: "servings",
        hozAlign: "right",
        editor: "number",
        width: 100
      },
      {
        title: "Cost ($)",
        hozAlign: "right",
        width: 100,
        formatter: cell => {
          const recipeId = cell.getRow().getData().id;
          return calculateRecipeCost(recipeId).toFixed(2);
        }
      },
      {
        title: "",
        formatter: () => "Add",
        width: 90,
        hozAlign: "center",
        cellClick: (e, cell) => {
          const recipeId = cell.getRow().getData().id;
          selectRecipe(recipeId);
        }
      },
      {
        title: "",
        formatter: () => "Edit Ingredients",
        width: 140,
        hozAlign: "center",
        cellClick: (e, cell) => {
          const recipe = cell.getRow().getData();
          openRecipeIngredientsEditor(recipe);
        }
      }
    ]
  });
}

async function saveRecipes() {
  try {
    const recipesData = state.tables.recipes.getData();
    
    const response = await fetch("/recipes/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recipesData)
    });
    
    if (!response.ok) {
      throw new Error("Failed to save recipes");
    }
    
    await response.json();
    
    // Update selected recipes with any changes
    state.selectedRecipes.forEach(selectedRecipe => {
      const updatedRecipe = recipesData.find(r => r.id === selectedRecipe.id);
      if (updatedRecipe) {
        Object.assign(selectedRecipe, updatedRecipe);
      }
    });
    state.tables.selectedRecipes.replaceData(state.selectedRecipes);
    
    alert("Recipes saved!");
  } catch (error) {
    console.error("Failed to save recipes:", error);
    alert("Failed to save recipes");
  }
}

function openRecipeIngredientsEditor(recipe) {
  state.editingRecipe = recipe;
  
  // Get ingredients for this recipe
  const recipeIngs = state.recipeIngredients.filter(ri => ri.recipe_id === recipe.id);
  
  // Show the modal
  document.getElementById("recipe-editor-modal").style.display = "block";
  document.getElementById("editor-recipe-name").textContent = recipe.name;
  
  // Initialize the ingredient editor table
  if (state.tables.ingredientEditor) {
    state.tables.ingredientEditor.destroy();
  }
  
  state.tables.ingredientEditor = new Tabulator("#ingredient-editor-table", {
    data: recipeIngs,
    layout: "fitColumns",
    columns: [
      {
        title: "Ingredient",
        field: "ingredient_id",
        editor: "list",
        editorParams: {
          values: state.ingredients.reduce((acc, ing) => {
            acc[ing.ingredient_id] = ing.ingredient_name;
            return acc;
          }, {})
        },
        formatter: cell => {
          const ingredientId = cell.getValue();
          return state.ingredientById.get(ingredientId) || "";
        }
      },
      {
        title: "Quantity",
        field: "quantity",
        editor: "number",
        hozAlign: "right",
        width: 120
      },
      {
        title: "Unit",
        field: "unit",
        editor: "input",
        width: 120
      },
      {
        title: "",
        formatter: () => "Remove",
        width: 90,
        hozAlign: "center",
        cellClick: (e, cell) => {
          cell.getRow().delete();
        }
      }
    ]
  });
}

function closeRecipeEditor() {
  document.getElementById("recipe-editor-modal").style.display = "none";
  state.editingRecipe = null;
  if (state.tables.ingredientEditor) {
    state.tables.ingredientEditor.destroy();
    state.tables.ingredientEditor = null;
  }
}

function addIngredientRow() {
  if (!state.tables.ingredientEditor) return;
  
  // Add a new empty row
  state.tables.ingredientEditor.addRow({
    recipe_id: state.editingRecipe.id,
    ingredient_id: state.ingredients[0].ingredient_id,
    quantity: 1,
    unit: "g"
  });
}

async function saveRecipeIngredients() {
  try {
    const ingredientsData = state.tables.ingredientEditor.getData();
    
    // Update the local state
    state.recipeIngredients = state.recipeIngredients.filter(
      ri => ri.recipe_id !== state.editingRecipe.id
    );
    state.recipeIngredients.push(...ingredientsData);
    
    // Save to backend
    const response = await fetch("/shopping/recipe_ingredients/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipe_id: state.editingRecipe.id,
        ingredients: ingredientsData
      })
    });
    
    if (!response.ok) {
      throw new Error("Failed to save recipe ingredients");
    }
    
    await response.json();
    
    // Update recipe costs in tables
    state.tables.recipes.redraw(true);
    if (state.tables.selectedRecipes) {
      state.tables.selectedRecipes.redraw(true);
    }
    
    // Update shopping list if this recipe is selected
    const isSelected = state.selectedRecipes.some(r => r.id === state.editingRecipe.id);
    if (isSelected) {
      updateShoppingList();
    }
    
    alert("Recipe ingredients saved!");
    closeRecipeEditor();
  } catch (error) {
    console.error("Failed to save recipe ingredients:", error);
    alert("Failed to save recipe ingredients");
  }
}


// ====================
// INGREDIENTS TABLE
// ====================

function initializeIngredientsTable() {
  state.tables.ingredients = new Tabulator("#ingredients-table", {
    data: state.ingredients,
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
          const ingredient = cell.getRow().getData();
          updateIngredientCost(ingredient.ingredient_id, ingredient.cost_per_unit);
        }
      },
      {
        title: "",
        formatter: () => "Add",
        width: 90,
        hozAlign: "center",
        cellClick: (e, cell) => {
          const ingredient = cell.getRow().getData();
          addManualIngredient(ingredient.ingredient_id, ingredient.ingredient_name);
        }
      }
    ]
  });
}

function updateIngredientCost(ingredientId, newCost) {
  state.costByIngredientId.set(ingredientId, newCost || 0);
  
  // Refresh cost displays in both recipe tables
  state.tables.recipes.redraw(true);
  state.tables.selectedRecipes.redraw(true);
}

function addManualIngredient(ingredientId, ingredientName) {
  // Check if ingredient is already manually added
  const existing = state.manualIngredients.find(i => i.id === ingredientId);
  
  if (existing) {
    // Increment quantity if already exists
    existing.quantity += 1;
  } else {
    // Add new manual ingredient with default quantity of 1
    state.manualIngredients.push({
      id: ingredientId,
      name: ingredientName,
      quantity: 1
    });
  }
  
  updateShoppingList();
}

function removeManualIngredient(ingredientId) {
  state.manualIngredients = state.manualIngredients.filter(i => i.id !== ingredientId);
  updateShoppingList();
}


// ====================
// SELECTED RECIPES TABLE
// ====================

function initializeSelectedRecipesTable() {
  state.tables.selectedRecipes = new Tabulator("#selected-recipes-table", {
    data: state.selectedRecipes,
    layout: "fitColumns",
    reactiveData: true,
    columns: [
      {
        title: "Selected Recipe",
        field: "name"
      },
      {
        title: "Servings",
        field: "servings",
        hozAlign: "right",
        editor: "number",
        width: 100,
        cellEdited: cell => {
          updateShoppingList();
        }
      },
      {
        title: "",
        formatter: () => "Remove",
        width: 90,
        hozAlign: "center",
        cellClick: (e, cell) => {
          const recipeId = cell.getRow().getData().id;
          deselectRecipe(recipeId);
        }
      }
    ]
  });
}

function selectRecipe(recipeId) {
  // Prevent duplicate selections
  if (state.selectedRecipes.some(recipe => recipe.id === recipeId)) {
    return;
  }
  
  const recipe = state.recipes.find(r => r.id === recipeId);
  if (!recipe) {
    console.error("Recipe not found:", recipeId);
    return;
  }
  
  state.selectedRecipes.push(recipe);
  state.tables.selectedRecipes.replaceData(state.selectedRecipes);
  updateShoppingList();
}

function deselectRecipe(recipeId) {
  state.selectedRecipes = state.selectedRecipes.filter(recipe => recipe.id !== recipeId);
  state.tables.selectedRecipes.replaceData(state.selectedRecipes);
  updateShoppingList();
}


// ====================
// SHOPPING LIST TABLE
// ====================

function initializeShoppingTable() {
  state.tables.shopping = new Tabulator("#shopping-table", {
    data: [],
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
      },
      {
        title: "Source",
        field: "source",
        width: 120,
        hozAlign: "center"
      },
      {
        title: "",
        formatter: (cell) => {
          const row = cell.getRow().getData();
          // Only show remove button for manually added ingredients
          return row.source === "Manual" ? "Remove" : "";
        },
        width: 90,
        hozAlign: "center",
        cellClick: (e, cell) => {
          const row = cell.getRow().getData();
          if (row.source === "Manual" && row.ingredientId) {
            removeManualIngredient(row.ingredientId);
          }
        }
      }
    ]
  });
}

function updateShoppingList() {
  const shoppingMap = calculateShoppingList();
  const shoppingData = Array.from(shoppingMap, ([ingredient, data]) => ({
    ingredient,
    quantity: data.quantity,
    source: data.source,
    ingredientId: data.ingredientId
  }));
  
  state.tables.shopping.replaceData(shoppingData);
}

function calculateShoppingList() {
  const shoppingMap = new Map();
  
  // Add ingredients from selected recipes
  state.selectedRecipes.forEach(recipe => {
    const recipeIngredientsForRecipe = state.recipeIngredients
      .filter(ri => ri.recipe_id === recipe.id);
    
    // Calculate the multiplier based on servings
    const servingsMultiplier = recipe.servings || 1;
    
    recipeIngredientsForRecipe.forEach(ri => {
      const ingredientName = state.ingredientById.get(ri.ingredient_id);
      const adjustedQuantity = ri.quantity * servingsMultiplier;
      const existing = shoppingMap.get(ingredientName);
      
      if (existing) {
        existing.quantity += adjustedQuantity;
        existing.source = "Mixed"; // From both recipes and manual
      } else {
        shoppingMap.set(ingredientName, {
          quantity: adjustedQuantity,
          source: "Recipe",
          ingredientId: ri.ingredient_id
        });
      }
    });
  });
  
  // Add manually added ingredients
  state.manualIngredients.forEach(ingredient => {
    const existing = shoppingMap.get(ingredient.name);
    
    if (existing) {
      existing.quantity += ingredient.quantity;
      existing.source = "Mixed"; // From both recipes and manual
    } else {
      shoppingMap.set(ingredient.name, {
        quantity: ingredient.quantity,
        source: "Manual",
        ingredientId: ingredient.id
      });
    }
  });
  
  return shoppingMap;
}


// ====================
// COST CALCULATION
// ====================

function calculateRecipeCost(recipeId) {
  const recipeIngredientsForRecipe = state.recipeIngredients
    .filter(ri => ri.recipe_id === recipeId);
  
  return recipeIngredientsForRecipe.reduce((total, ri) => {
    const cost = state.costByIngredientId.get(ri.ingredient_id) || 0;
    return total + (cost * ri.quantity);
  }, 0);
}

// Setup button event listeners
document.getElementById("close-editor-btn").onclick = closeRecipeEditor;
document.getElementById("add-ingredient-btn").onclick = addIngredientRow;
document.getElementById("save-ingredients-btn").onclick = saveRecipeIngredients;

// Close modal when clicking outside of it
window.onclick = function(event) {
  const modal = document.getElementById("recipe-editor-modal");
  if (event.target === modal) {
    closeRecipeEditor();
  }
};


// ====================
// START APPLICATION
// ====================

initialize();