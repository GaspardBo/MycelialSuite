// ====================
// STATE MANAGEMENT
// ====================

const state = {
  recipes: [],
  ingredients: [],
  recipeIngredients: [],
  selectedRecipes: [],
  manualIngredients: [], // Manually added ingredients
  
  // Lookup maps for quick access
  ingredientById: new Map(),
  costByIngredientId: new Map(),
  
  // Tabulator instances
  tables: {
    recipes: null,
    ingredients: null,
    selectedRecipes: null,
    shopping: null,
    ingredientEditor: null, // For recipe ingredients modal
    ingredientDataEditor: null // For ingredients data modal
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

let editingRecipe = null;

function initializeRecipesTable() {
  state.tables.recipes = new Tabulator("#recipes-table", {
    data: state.recipes,
    layout: "fitColumns",
    reactiveData: true,
    columns: [
      {
        title: "Recipe",
        field: "name",
        headerFilter: "input"
      },
      {
        title: "Prep Time (min)",
        field: "prep_time_minutes",
        hozAlign: "right",
        width: 130
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
        formatter: () => `
          <div style='display: flex; gap: 8px; justify-content: center;'>
            <div style='padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;' class='add-btn'>+</div>
            <div style='padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;' class='edit-btn'>⚙</div>
          </div>
        `,
        width: 100,
        hozAlign: "center",
        cellClick: (e, cell) => {
          const recipe = cell.getRow().getData();
          if (e.target.classList.contains('add-btn') || e.target.closest('.add-btn')) {
            selectRecipe(recipe.id);
          } else if (e.target.classList.contains('edit-btn') || e.target.closest('.edit-btn')) {
            openRecipeEditor(recipe);
          }
        }
      }
    ]
  });
}

async function saveRecipes() {
  try {
    const recipesData = state.tables.recipes.getData();
    
    const response = await fetch("/shopping/recipes/update", {
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
  } catch (error) {
    console.error("Failed to save recipes:", error);
    alert("Failed to save recipes");
  }
}

function openRecipeEditor(recipe) {
  editingRecipe = recipe;
  
  // Show the modal
  document.getElementById("recipe-editor-modal").style.display = "block";
  
  // Populate the form fields
  document.getElementById("edit-recipe-name").value = recipe.name;
  document.getElementById("edit-recipe-prep-time").value = recipe.prep_time_minutes || 0;
  document.getElementById("edit-recipe-servings").value = recipe.servings || 1;
  
  // Display calculated cost
  const cost = calculateRecipeCost(recipe.id);
  document.getElementById("display-recipe-cost").textContent = cost.toFixed(2);
  
  // Get ingredients for this recipe
  const recipeIngs = state.recipeIngredients.filter(ri => ri.recipe_id === recipe.id);
  
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
        editor: function(cell, onRendered, success, cancel) {
          const container = document.createElement("div");
          const input = document.createElement("input");
          const datalistId = "ingredient-datalist-" + Math.random().toString(36).substr(2, 9);
          const datalist = document.createElement("datalist");
          
          input.setAttribute("list", datalistId);
          input.style.width = "100%";
          input.style.padding = "4px";
          input.style.boxSizing = "border-box";
          
          datalist.id = datalistId;
          
          // Populate datalist with ingredients
          state.ingredients.forEach(ing => {
            const option = document.createElement("option");
            option.value = ing.ingredient_name;
            option.setAttribute("data-id", ing.ingredient_id);
            datalist.appendChild(option);
          });
          
          // Set initial value - show ingredient name for the current ingredient_id
          const currentId = cell.getValue();
          const currentName = state.ingredientById.get(currentId);
          input.value = currentName || "";
          
          container.appendChild(input);
          container.appendChild(datalist);
          
          onRendered(() => {
            input.focus();
            input.select();
          });
          
          // Handle selection
          function setValue() {
            const selectedName = input.value.trim();
            const ingredient = state.ingredients.find(i => i.ingredient_name === selectedName);
            
            if (ingredient) {
              success(ingredient.ingredient_id);
              // Update cost when ingredient changes
              setTimeout(() => {
                const cost = calculateRecipeCost(editingRecipe.id);
                document.getElementById("display-recipe-cost").textContent = cost.toFixed(2);
              }, 100);
            } else if (selectedName === "") {
              // If empty, keep the original value
              cancel();
            } else {
              // Invalid ingredient name, cancel edit
              alert("Please select a valid ingredient from the list");
              cancel();
            }
          }
          
          input.addEventListener("blur", setValue);
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setValue();
            } else if (e.key === "Escape") {
              cancel();
            }
          });
          
          return container;
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
        width: 120,
        cellEdited: () => {
          // Update cost when quantity changes
          const cost = calculateRecipeCost(editingRecipe.id);
          document.getElementById("display-recipe-cost").textContent = cost.toFixed(2);
        }
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
          // Update cost when ingredient is removed
          const cost = calculateRecipeCost(editingRecipe.id);
          document.getElementById("display-recipe-cost").textContent = cost.toFixed(2);
        }
      }
    ]
  });
}

function closeRecipeEditor() {
  document.getElementById("recipe-editor-modal").style.display = "none";
  editingRecipe = null;
  if (state.tables.ingredientEditor) {
    state.tables.ingredientEditor.destroy();
    state.tables.ingredientEditor = null;
  }
}

function addIngredientRow() {
  if (!state.tables.ingredientEditor) return;
  
  // Add a new row with the first ingredient selected by default
  const firstIngredient = state.ingredients[0];
  
  state.tables.ingredientEditor.addRow({
    recipe_id: editingRecipe.id,
    ingredient_id: firstIngredient ? firstIngredient.ingredient_id : 1,
    quantity: 1,
    unit: "g"
  }, true); // true = add to top of table
  
  // Update cost when ingredient is added
  const cost = calculateRecipeCost(editingRecipe.id);
  document.getElementById("display-recipe-cost").textContent = cost.toFixed(2);
}

async function saveRecipeAndIngredients() {
  if (!editingRecipe) return;
  
  try {
    // Get updated values from form
    const updatedName = document.getElementById("edit-recipe-name").value;
    const updatedPrepTime = parseInt(document.getElementById("edit-recipe-prep-time").value) || 0;
    const updatedServings = parseInt(document.getElementById("edit-recipe-servings").value) || 1;
    
    // Update the recipe in the local state
    const recipe = state.recipes.find(r => r.id === editingRecipe.id);
    if (recipe) {
      recipe.name = updatedName;
      recipe.prep_time_minutes = updatedPrepTime;
      recipe.servings = updatedServings;
    }
    
    // Get ingredients data
    const ingredientsData = state.tables.ingredientEditor.getData();
    
    // Update the local state for ingredients
    state.recipeIngredients = state.recipeIngredients.filter(
      ri => ri.recipe_id !== editingRecipe.id
    );
    state.recipeIngredients.push(...ingredientsData);
    
    // Save recipes to backend
    const recipesResponse = await fetch("/shopping/recipes/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.recipes)
    });
    
    if (!recipesResponse.ok) {
      throw new Error("Failed to save recipe");
    }
    
    // Save recipe ingredients to backend
    const ingredientsResponse = await fetch("/shopping/recipes/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipe_id: editingRecipe.id,
        ingredients: ingredientsData
      })
    });
    
    if (!ingredientsResponse.ok) {
      throw new Error("Failed to save recipe ingredients");
    }
    
    // Refresh the main recipes table
    state.tables.recipes.replaceData(state.recipes);
    
    // Update selected recipes if this recipe is selected
    const selectedRecipe = state.selectedRecipes.find(r => r.id === editingRecipe.id);
    if (selectedRecipe) {
      Object.assign(selectedRecipe, recipe);
      state.tables.selectedRecipes.replaceData(state.selectedRecipes);
    }
    
    // Update shopping list if this recipe is selected
    const isSelected = state.selectedRecipes.some(r => r.id === editingRecipe.id);
    if (isSelected) {
      updateShoppingList();
    }
    
    closeRecipeEditor();
  } catch (error) {
    console.error("Failed to save recipe:", error);
    alert("Failed to save recipe");
  }
}

async function deleteRecipe() {
  if (!editingRecipe) return;
  
  if (!confirm(`Are you sure you want to delete "${editingRecipe.name}"? This cannot be undone.`)) {
    return;
  }
  
  try {
    // Remove from local state
    state.recipes = state.recipes.filter(r => r.id !== editingRecipe.id);
    
    // Remove associated recipe ingredients
    state.recipeIngredients = state.recipeIngredients.filter(
      ri => ri.recipe_id !== editingRecipe.id
    );
    
    // Remove from selected recipes if present
    state.selectedRecipes = state.selectedRecipes.filter(r => r.id !== editingRecipe.id);
    
    // Save recipes to backend
    const recipesResponse = await fetch("/shopping/recipes/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.recipes)
    });
    
    if (!recipesResponse.ok) {
      throw new Error("Failed to delete recipe");
    }
    
    // Save recipe ingredients to backend (to remove deleted recipe's ingredients)
    const ingredientsResponse = await fetch("/shopping/recipes/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipe_id: editingRecipe.id,
        ingredients: []
      })
    });
    
    if (!ingredientsResponse.ok) {
      throw new Error("Failed to delete recipe ingredients");
    }
    
    // Refresh tables
    state.tables.recipes.replaceData(state.recipes);
    state.tables.selectedRecipes.replaceData(state.selectedRecipes);
    updateShoppingList();
    
    closeRecipeEditor();
  } catch (error) {
    console.error("Failed to delete recipe:", error);
    alert("Failed to delete recipe");
  }
}

function openRecipeIngredientsEditor(recipe) {
  // This function is now merged with openRecipeEditor
  openRecipeEditor(recipe);
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
        title: "",
        formatter: () => `
          <div style='display: flex; gap: 8px; justify-content: center;'>
            <div style='padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;' class='add-btn'>+</div>
            <div style='padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;' class='subtract-btn'>-</div>
            <div style='padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;' class='edit-btn'>⚙</div>
          </div>
        `,
        width: 150,
        hozAlign: "center",
        cellClick: (e, cell) => {
          const ingredient = cell.getRow().getData();
          if (e.target.classList.contains('add-btn') || e.target.closest('.add-btn')) {
            addManualIngredient(ingredient.ingredient_id, ingredient.ingredient_name);
          } else if (e.target.classList.contains('subtract-btn') || e.target.closest('.subtract-btn')) {
            subtractManualIngredient(ingredient.ingredient_id);
          } else if (e.target.classList.contains('edit-btn') || e.target.closest('.edit-btn')) {
            openIngredientDataEditor(ingredient);
          }
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

function subtractManualIngredient(ingredientId) {
  const existing = state.manualIngredients.find(i => i.id === ingredientId);
  
  if (existing) {
    existing.quantity -= 1;
    
    // Remove ingredient if quantity reaches 0
    if (existing.quantity <= 0) {
      state.manualIngredients = state.manualIngredients.filter(i => i.id !== ingredientId);
    }
    
    updateShoppingList();
  }
}

function removeManualIngredient(ingredientId) {
  state.manualIngredients = state.manualIngredients.filter(i => i.id !== ingredientId);
  updateShoppingList();
}

async function addNewRecipe() {
  try {
    // Find the next available recipe ID
    const maxId = Math.max(...state.recipes.map(r => r.id), 0);
    
    const newRecipe = {
      id: maxId + 1,
      name: "New Recipe",
      prep_time_minutes: 0,
      servings: 1
    };
    
    // Add to local state
    state.recipes.push(newRecipe);
    
    // Save to backend
    const response = await fetch("/shopping/recipes/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.recipes)
    });
    
    if (!response.ok) {
      throw new Error("Failed to add recipe");
    }
    
    // Refresh table
    state.tables.recipes.replaceData(state.recipes);
    
    // Open editor for the new recipe
    openRecipeEditor(newRecipe);
  } catch (error) {
    console.error("Failed to add recipe:", error);
    alert("Failed to add recipe");
  }
}

async function addNewIngredient() {
  try {
    // Find the next available ingredient ID
    const maxId = Math.max(...state.ingredients.map(i => i.ingredient_id), 0);
    
    const newIngredient = {
      ingredient_id: maxId + 1,
      ingredient_name: "New Ingredient",
      cost_per_unit: 0
    };
    
    // Add to local state
    state.ingredients.push(newIngredient);
    buildIngredientLookups();
    
    // Save to backend
    const response = await fetch("/shopping/ingredients/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.ingredients)
    });
    
    if (!response.ok) {
      throw new Error("Failed to add ingredient");
    }
    
    // Refresh table
    state.tables.ingredients.replaceData(state.ingredients);
    
    // Open editor for the new ingredient
    openIngredientDataEditor(newIngredient);
  } catch (error) {
    console.error("Failed to add ingredient:", error);
    alert("Failed to add ingredient");
  }
}


// ====================
// INGREDIENT DATA EDITOR MODAL
// ====================

let editingIngredient = null;

function openIngredientDataEditor(ingredient) {
  editingIngredient = ingredient;
  
  // Show the modal
  document.getElementById("ingredient-data-editor-modal").style.display = "block";
  
  // Populate the form fields
  document.getElementById("edit-ingredient-name").value = ingredient.ingredient_name;
  document.getElementById("edit-ingredient-cost").value = ingredient.cost_per_unit || 0;
}

function closeIngredientDataEditor() {
  document.getElementById("ingredient-data-editor-modal").style.display = "none";
  editingIngredient = null;
}

async function saveIngredientData() {
  if (!editingIngredient) return;
  
  try {
    // Get updated values from form
    const updatedName = document.getElementById("edit-ingredient-name").value;
    const updatedCost = parseFloat(document.getElementById("edit-ingredient-cost").value) || 0;
    
    // Update the ingredient in the local state
    const ingredient = state.ingredients.find(i => i.ingredient_id === editingIngredient.ingredient_id);
    if (ingredient) {
      ingredient.ingredient_name = updatedName;
      ingredient.cost_per_unit = updatedCost;
    }
    
    // Rebuild lookups
    buildIngredientLookups();
    
    // Save to backend
    const response = await fetch("/shopping/ingredients/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.ingredients)
    });
    
    if (!response.ok) {
      throw new Error("Failed to save ingredient");
    }
    
    await response.json();
    
    // Refresh the main ingredients table
    state.tables.ingredients.replaceData(state.ingredients);
    
    // Update recipe costs
    state.tables.recipes.redraw(true);
    if (state.tables.selectedRecipes) {
      state.tables.selectedRecipes.redraw(true);
    }
    
    // Update shopping list in case ingredient name changed
    updateShoppingList();
    
    closeIngredientDataEditor();
  } catch (error) {
    console.error("Failed to save ingredient:", error);
    alert("Failed to save ingredient");
  }
}

async function deleteIngredient() {
  if (!editingIngredient) return;
  
  // Check if ingredient is used in any recipes
  const usedInRecipes = state.recipeIngredients.some(
    ri => ri.ingredient_id === editingIngredient.ingredient_id
  );
  
  if (usedInRecipes) {
    alert("Cannot delete this ingredient because it is used in one or more recipes. Please remove it from all recipes first.");
    return;
  }
  
  if (!confirm(`Are you sure you want to delete "${editingIngredient.ingredient_name}"? This cannot be undone.`)) {
    return;
  }
  
  try {
    // Remove from local state
    state.ingredients = state.ingredients.filter(i => i.ingredient_id !== editingIngredient.ingredient_id);
    
    // Rebuild lookups
    buildIngredientLookups();
    
    // Remove from manual ingredients if present
    state.manualIngredients = state.manualIngredients.filter(
      i => i.id !== editingIngredient.ingredient_id
    );
    
    // Save to backend
    const response = await fetch("/shopping/ingredients/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.ingredients)
    });
    
    if (!response.ok) {
      throw new Error("Failed to delete ingredient");
    }
    
    // Refresh tables
    state.tables.ingredients.replaceData(state.ingredients);
    updateShoppingList();
    
    closeIngredientDataEditor();
  } catch (error) {
    console.error("Failed to delete ingredient:", error);
    alert("Failed to delete ingredient");
  }
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
        formatter: () => `
          <div style='display: flex; gap: 8px; justify-content: center;'>
            <div style='padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;' class='remove-btn'>Remove</div>
          </div>
        `,
        width: 100,
        hozAlign: "center",
        cellClick: (e, cell) => {
          const recipeId = cell.getRow().getData().id;
          if (e.target.classList.contains('remove-btn') || e.target.closest('.remove-btn')) {
            deselectRecipe(recipeId);
          }
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
// PRINT FUNCTION
// ====================

async function printShoppingList() {
  try {
    // Get current shopping list data
    const shoppingData = state.tables.shopping.getData();
    
    if (shoppingData.length === 0) {
      alert("Shopping list is empty. Add some recipes or ingredients first!");
      return;
    }
    
    // Send to backend for printing
    const response = await fetch("/shopping/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopping_list: shoppingData
      })
    });
    
    if (!response.ok) {
      throw new Error("Failed to print shopping list");
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log("Shopping list sent to printer successfully");
    } else {
      throw new Error(result.error || "Print failed");
    }
  } catch (error) {
    console.error("Failed to print shopping list:", error);
    alert("Failed to print shopping list: " + error.message);
  }
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


// ====================
// EVENT LISTENERS
// ====================

// Add new recipe/ingredient buttons
document.getElementById("add-new-recipe-btn").onclick = addNewRecipe;
document.getElementById("add-new-ingredient-btn").onclick = addNewIngredient;

// Print button
document.getElementById("print-shopping-list-btn").onclick = printShoppingList;

// Recipe editor modal
document.getElementById("close-recipe-editor-btn").onclick = closeRecipeEditor;
document.getElementById("cancel-recipe-editor-btn").onclick = closeRecipeEditor;
document.getElementById("add-ingredient-btn").onclick = addIngredientRow;
document.getElementById("save-recipe-btn").onclick = saveRecipeAndIngredients;
document.getElementById("delete-recipe-btn").onclick = deleteRecipe;

// Ingredient data editor modal
document.getElementById("close-ingredient-data-editor-btn").onclick = closeIngredientDataEditor;
document.getElementById("cancel-ingredient-data-editor-btn").onclick = closeIngredientDataEditor;
document.getElementById("save-ingredient-data-btn").onclick = saveIngredientData;
document.getElementById("delete-ingredient-btn").onclick = deleteIngredient;

// Close modals when clicking outside of them
window.onclick = function(event) {
  const recipeModal = document.getElementById("recipe-editor-modal");
  const ingredientModal = document.getElementById("ingredient-data-editor-modal");
  
  if (event.target === recipeModal) {
    closeRecipeEditor();
  }
  if (event.target === ingredientModal) {
    closeIngredientDataEditor();
  }
};


// ====================
// START APPLICATION
// ====================

initialize();