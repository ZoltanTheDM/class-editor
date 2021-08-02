
const CLASS_STORAGE = "stored-classes";
const MODULE_NAME = "class-exposure";

const MAX_LEVEL = 20;

// Set up the user interface
Hooks.on("renderSidebarTab", async (app, html) => {
	if (app.options.id == "actors") {
		let button = $("<button class='cl-editor'>Edit Classes</button>")

		button.click(function () {
			ClassEditor.getClassFeatures();
			new ClassEditor().render(true);
		});

		html.find(".directory-footer").append(button);
	}
});

class ClassEditor extends Application{

	static classFeatures;
	static currentClass;
	static currentSubclass;

	static getClassFeatures(){
		ClassEditor.classFeatures = game.settings.get(MODULE_NAME, CLASS_STORAGE);
		ClassEditor.currentClass = Object.keys(ClassEditor.classFeatures)[0];
		ClassEditor.currentSubclass = "";
	}

	static get defaultOptions()
	{
		const options = super.defaultOptions;
		options.id = "class-editor";
		options.template = "modules/class-editor/templates/class-editor-ui.html"
		// options.classes.push("class-editor");
		options.resizable = true;
		options.height = "auto";
		options.width = 600;
		options.minimizable = true;
		options.title = "Class Editor"
		return options;
	}

	async getData(options) {
		return {
			classes: ClassEditor.getClassList(),
			subclasses: ClassEditor.getCurrentSubclassData(),
			levelList: await ClassEditor.getLevelList(),
		}
	}

	static getClassList(){
		return Object.keys(ClassEditor.classFeatures).map(string => {
			return {
				//capatilize first letter of class
				label: string.charAt(0).toUpperCase() + string.slice(1),
				//key value of class
				value: string,
				isSelected: string == ClassEditor.currentClass ? "selected" : "",
			}
		});
	}

	static getCurrentSubclassData (){
		if (!ClassEditor.classFeatures || !ClassEditor.classFeatures[ClassEditor.currentClass] || !ClassEditor.classFeatures[ClassEditor.currentClass]["subclasses"]){
			console.warn(`could not find subclasses for: \"${ClassEditor.currentClass}\"`)
			return []
		}

		let subclassList = [];
		for (let [key, value] of Object.entries(ClassEditor.classFeatures[ClassEditor.currentClass]["subclasses"])){
			let label = value.label || "";
			subclassList.push({
				label: label,
				value: key,
				isSelected: key == ClassEditor.currentSubclass ? "selected" : "",
			})
		}

		return subclassList;
	}

	static getFeatureList(){
		if (ClassEditor.currentSubclass == ""){
			return ClassEditor.classFeatures[ClassEditor.currentClass]["features"];
		}

		//some subclasses dont have features field by default
		return ClassEditor.classFeatures[ClassEditor.currentClass]["subclasses"][ClassEditor.currentSubclass]["features"] || {};
	}

	static async getLevelList(){
		let list = {}

		const allFeatures = ClassEditor.getFeatureList();

		for (let i = 1; i <= MAX_LEVEL ; i++){
			list[i] = {
				level: i,
				features: await Promise.all((allFeatures[i] || []).map(fromUuid))
			};
		}

		return await list;
	}

	activateListeners(html) {

		//uses fromUuid to get items from string
		//string Uses {Compendium}.{from game.packs}.{item id}

		super.activateListeners(html);
		this.currentValue = "barbarian";

		let classes = html.find(".class-list");

		classes.on("change", null, function (argument) {
			ClassEditor.currentClass = document.getElementById("sel.classes").value;
			ClassEditor.currentSubclass = "";
			this.render();
		}.bind(this));

		let subclasses = html.find(".subclass-list");

		subclasses.on("change", null, function (argument) {
			ClassEditor.currentSubclass = document.getElementById("sel.subclasses").value;
			this.render();
		}.bind(this));


		// for (let key of Object.entries(ClassEditor.classFeatures)){
		// 	console.log(key[0]);
		// 	classDropDown.add(new Option(key[0]+"2", key[0]+"2"));
		// }
	}
}
