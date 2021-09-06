
const CLASS_STORAGE = "stored-classes";
const STORAGE_MODULE_NAME = "class-exposure";
const MODULE_NAME = "class-editor";
const MODULE_LABEL = "Class Leveling Editor";
const MAX_LEVEL_NAME = "MaxLevel";

Hooks.on("init", async(app, hmtl) => {
	game.settings.registerMenu(MODULE_NAME, "FormData", {
		name: "Edit Class Auto-Leveling",
		hint: "Go to dialog to edit which items class and subclass recieve on level up",
		label: "Edit Class Leveling",
		icon: 'fas fa-atlas',
		type: ClassEditor,
		restricted: true,
	});

	game.settings.register(MODULE_NAME, MAX_LEVEL_NAME, {
		name: 'Max Level',
		hint: "Must 'Save Changes' for this setting it to take effect. Only enter numbers please.",
		scope: 'world',
		config: true,
		type: Number,
		default: 20,
		restricted: true
	});

	game.settings.registerMenu(MODULE_NAME, "ImportData", {
		name: "Import/Export Data",
		hint: "Go to dialog to import and export class leveling",
		label: "Import/Export Leveling",
		icon: 'fas fa-file-import',
		type: ImportExporter,
		restricted: true,
	});

})

class ClassEditor extends FormApplication{
	constructor() {
		super({});
		ClassEditor.getClassFeatures();
	}

	static classFeatures;
	static currentClass;
	static currentSubclass;

	static getClassFeatures(){
		ClassEditor.classFeatures = game.settings.get(STORAGE_MODULE_NAME, CLASS_STORAGE);
		ClassEditor.currentClass = Object.keys(ClassEditor.classFeatures)[0];
		ClassEditor.currentSubclass = "";
	}

	static saveClassFeatures(){
		console.log(`${MODULE_LABEL} | Saving class leveling`);
		CONFIG.DND5E.classFeatures = ClassEditor.classFeatures;
		game.settings.set(STORAGE_MODULE_NAME, CLASS_STORAGE, ClassEditor.classFeatures);
	}

	static get defaultOptions()
	{
		let overrides = {
			id: "class-editor",
			template: "modules/class-editor/templates/class-editor-ui.html",
			resizable: true,
			width: 600,
			id: 'ce-class-editor',
			minimizable: true,
			title: "Class Leveling Editor",
		}
		return foundry.utils.mergeObject(super.defaultOptions, overrides);;
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

		const level = parseInt(game.settings.get(MODULE_NAME, MAX_LEVEL_NAME));
		for (let i = 1; i <= level ; i++){
			list[i] = {
				level: i,
				features: await Promise.all((allFeatures[i] || []).map(async (data, idx)=>{
					return {
						data: await fromUuid(data),
						idx: idx,
						uuid: data,
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

		html.find(".remove-feature").on("click", null, function(ev){
			const id = ev.currentTarget.closest(".item").id
			let deletingRegex = id.match(/item-(\d+)-(\d+)/);

			ClassEditor.removeItem(parseInt(deletingRegex[1]), parseInt(deletingRegex[2]));

			this.render();
		}.bind(this));

		html.find(".item-edit").on("click", null, async function(ev){
			const li = event.currentTarget.closest(".item");
			let item = await fromUuid(li.dataset.itemId);
			item.sheet.render(true);
		}.bind(this));
	}
}

class ImportExporter extends FormApplication{
	constructor() {
		super({});
		this.currentValues = game.settings.get(STORAGE_MODULE_NAME, CLASS_STORAGE);
	}

	static get defaultOptions()
	{
		let overrides = {
			id: "class-importer",
			template: "modules/class-editor/templates/import-export.html",
			resizable: true,
			width: 600,
			id: 'ce-class-editor-import',
			minimizable: true,
			title: "Class Leveling Import/Exporter",
		}
		return foundry.utils.mergeObject(super.defaultOptions, overrides);
	}

	async getData(options) {
	}

	activateListeners(html) {
		super.activateListeners(html);

		//export by copying text area
		document.getElementById("import-exporter").value = JSON.stringify(this.currentValues, null, 2);
	}

	async _updateObject(event, formData){
		let dataToImport
		try{
			dataToImport = JSON.parse(formData["import-exporter"]);
		}
		catch(e){
			console.error(e);
			ui.notifications.error(`failed to import because of issue with JSON formatting`);
			return;
		}

		if (!await this.verifyDataFormat(dataToImport)){
			ui.notifications.error(`failed to import because data was malformed. Check console for reason(s)`);
			return;
		}

		console.log(`${MODULE_LABEL} | Importing class leveling`);
		CONFIG.DND5E.classFeatures = dataToImport;
		game.settings.set(STORAGE_MODULE_NAME, CLASS_STORAGE, dataToImport);
	}

	//verify data format
	async verifyDataFormat(data){

		if (!(data instanceof Object)){
			console.error(`json data must be an object`);
			return false;
		}

		for (let key in data){
			//Every key must be a string
			if (typeof key !== "string"){
				console.error(`class key (${key}) is not an instance of a string`);
				return false;
			}

			//classes are all lower case
			if (key != key.toLowerCase()){
				console.error(`class key (${key}) is not all lowercase`);
				return false;
			}

			//classes must not have white space
			if (/\s/g.test(key)){
				console.error(`class key (${key}) must not have whitespace`);
				return false;
			}

			if (!("features" in data[key])){
				console.error(`class key (${key}) does not have features field`);
				return false;
			}

			if (!await this.verifyFeatures(data[key]["features"], `features in key (${key})`)){
				return false;
			}

			if (!("subclasses" in data[key])){
				console.error(`class key (${key}) does not have a subclasses field`);
				return false;
			}

			if (!(data[key]["subclasses"] instanceof Object)){
				console.error(`subclasses of key (${key}) must be an object`);
				return false;
			}

			for (let subclass in data[key]["subclasses"]){
				if(/[^a-z\-]/g.test(subclass)){
					console.error(`subclass key (${subclass}) of class key (${key}) must only contain lower case letters and -`);
					return false;
				}

				if (!(data[key]["subclasses"][subclass] instanceof Object)){
					console.error(`subclass key (${subclass}) of class key (${key}) must be an object`);
					return false;
				}

				if (!("label" in data[key]["subclasses"][subclass])){
					console.error(`subclass key (${subclass}) of class key (${key}) must have a label`);
					return false;
				}

				if (typeof data[key]["subclasses"][subclass]["label"] != "string"){
					console.error(`subclass key (${subclass}) of class key (${key}) must have a label that is a string`);
					return false;
				}

				//subclasses don't have to have features
				//but if they do check if they are right
				if ("features" in data[key]["subclasses"][subclass]){
					if (!await this.verifyFeatures(data[key]["subclasses"][subclass]["features"], `features in subclass "${data[key]["subclasses"][subclass]["label"]}" in class key (${key})`)){
						return false;
					}
				}
			}
		}

		return true;
	}

	async verifyFeatures(featuresObject, target){

		if (!(featuresObject instanceof Object)){
			console.error(`features of ${target} must be an object`);
			return false;
		}

		function isIntGtZero(str) {
			if (typeof str != "string") return false // we only process strings!  
			return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
			       !isNaN(parseFloat(str)) && // ...and ensure strings of whitespace fail
			       parseFloat(str) == parseInt(str) &&
			       parseInt(str) > 0
		}

		for (let level in featuresObject){
			if (!isIntGtZero(level)){
				console.error(`level (${level}) of ${target} is not a string integer greater then 0`);
				return false;
			}

			if (!(featuresObject[level] instanceof Array)){
				console.error(`level (${level}) of ${target} is not an Array`);
				return false;
			}

			//list of existing items
			let tempArr = [];

			for (let item of featuresObject[level]){
				if (typeof item != "string"){
					console.error(`in level (${level}) of ${target} has an item (${item}) that is not a string`);
					return false;
				}

				let item5e;
				try{
					item5e = await fromUuid(item);
				}
				catch(e){
				}

				if (!item5e){
					const message = `in level (${level}) of ${target} has an item (${item}) that we could not find. It will not be added to the list`
					console.warn(message);
					ui.notifications.warn(message);
				}
				else{
					tempArr.push(item);
				}
			}

			//good clean list of items
			featuresObject[level] = tempArr;
		}

		return true;
	}
}
