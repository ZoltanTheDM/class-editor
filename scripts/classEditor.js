
const CLASS_STORAGE = "stored-classes";
const STORAGE_MODULE_NAME = "class-exposure";

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
		ClassEditor.classFeatures = game.settings.get(STORAGE_MODULE_NAME, CLASS_STORAGE);
		ClassEditor.currentClass = Object.keys(ClassEditor.classFeatures)[0];
		ClassEditor.currentSubclass = "";
	}

	static saveClassFeatures(){
		CONFIG.DND5E.classFeatures = ClassEditor.classFeatures;
		game.settings.set(STORAGE_MODULE_NAME, CLASS_STORAGE, ClassEditor.classFeatures);
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
				features: await Promise.all((allFeatures[i] || []).map(async (data, idx)=>{
					return {
						data: await fromUuid(data),
						idx: idx,
					}
				}
				))
			};
		}

		return await list;
	}

	static makeUuid(data){
		if ("pack" in data){
			//is from compendium
			return `Compendium.${data["pack"]}.${data["id"]}`;
		}

		//it is an item from the world
		return `Item.${data["id"]}`;
	}

	static addToClass(level, data){
		if (data["type"] != "Item"){
			console.warn(`can't add ${data} because it is not an Item`);
			return;
		}

		let features;
		if (ClassEditor.currentSubclass == ""){
			features = ClassEditor.classFeatures[ClassEditor.currentClass]["features"];
		}
		else{
			if (!("features" in ClassEditor.classFeatures[ClassEditor.currentClass]["subclasses"][ClassEditor.currentSubclass])){
				ClassEditor.classFeatures[ClassEditor.currentClass]["subclasses"][ClassEditor.currentSubclass]["features"] = {};
			}

			//some subclasses dont have features field by default
			features = ClassEditor.classFeatures[ClassEditor.currentClass]["subclasses"][ClassEditor.currentSubclass]["features"];
		}

		if (!(level in features)){
			features[level] = [];
		}

		features[level].push(ClassEditor.makeUuid(data));

		ClassEditor.saveClassFeatures();
	}

	static removeItem(level, idx){
		let features = ClassEditor.getFeatureList();

		features[level].splice(idx, 1);

		ClassEditor.saveClassFeatures();
	}

	activateListeners(html) {

		super.activateListeners(html);
		this.currentValue = "barbarian";

		let classes = html.find(".class-list");

		//change class drop down
		classes.on("change", null, function () {
			ClassEditor.currentClass = document.getElementById("sel.classes").value;
			//reset current subclass to none
			ClassEditor.currentSubclass = "";
			this.render();
		}.bind(this));

		//change subclass dropdown
		let subclasses = html.find(".subclass-list");

		subclasses.on("change", null, function () {
			ClassEditor.currentSubclass = document.getElementById("sel.subclasses").value;
			this.render();
		}.bind(this));

		//drag and drop functionality
		let levelSections = html.find(".level-section");

		levelSections.on("drop", null, function(ev){
			let level = ev.currentTarget.id.match(/class-level-(\d+)/)[1]

			ClassEditor.addToClass(
				level,
				JSON.parse(ev.originalEvent.dataTransfer.getData("Text"))
			);

			this.render();
		}.bind(this));

		let deleteButtons = html.find(".remove-feature");

		deleteButtons.on("click", null, function(ev){
			let deletingRegex = ev.target.id.match(/del-(\d+)-(\d+)/);

			ClassEditor.removeItem(parseInt(deletingRegex[1]), parseInt(deletingRegex[2]));

			this.render();
		}.bind(this));
	}
}
