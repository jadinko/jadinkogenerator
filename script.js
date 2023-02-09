document.addEventListener("DOMContentLoaded", function () {
	////VARIOUS CONVENIENT FUNCTIONS
	function create(parent, tagName, className) {
		var e = document.createElement(tagName);
		e.className = className;
		if (parent) {
			parent.append(e);
		}
		return e;
	}

	function mapRange(value, sourceMin, sourceMax, destMin, destMax) {
		return (value - parseFloat(sourceMin)) / (parseFloat(sourceMax) - parseFloat(sourceMin)) * (parseFloat(destMax) - parseFloat(destMin)) + parseFloat(destMin);
	}

	function mapRandom(destMin, destMax) {
		return mapRange(Math.random(), 0.0, 1.0, destMin, destMax);
	}

	function getRandomWithProbabilities(a) {
		var total = 0;
		for (var one of a) {
			total += parseFloat(one[0]);
		}
		var r = Math.random() * total;
		total = 0; //Could use a different variable.
		for (var one of a) {
			total += parseFloat(one[0]);
			if (r < total) {
				return one[1];
			}
		}
		return a[0][1]; //Hopefully not needed.
	}

	function clampTextboxValue(selector, minValue, maxValue) {
		var limit = maxValue;
		if (selector === ".val-count") {
			document.querySelector(".val-type").addEventListener("change", function () {
				limit = getJadinkoTypeLimit();
				document.querySelector(".val-count").value = Math.min(document.querySelector(".val-count").value, limit);
			});
		}
		document.querySelectorAll(selector).forEach(function (textbox) {
			textbox.addEventListener("focusout", function () {
				this.value = clamp(this.value, minValue, limit);
			});
		});
	}

	function cmToFeetAndInches(cm) {
		var inches = cm / 2.54;
		var feet = Math.floor(inches / 12);
		inches = Math.round(inches % 12);
		return feet + "ft " + inches + "in";
	}

	function generateValue(maxValue, defaultValue) {
		var value = Math.random() * maxValue;
		var deviation = Math.abs(defaultValue - value) / (maxValue / 100);
		var probability = Math.pow(0.9, deviation);
		var iteration = 0;
		const maxIterations = 10000;
		while (Math.random() > probability) {
			value = Math.random() * maxValue;
			if (value > maxValue) {
				value = defaultValue;
			}
			deviation = Math.abs(defaultValue - value) / (maxValue / 100);
			probability = Math.pow(0.9, deviation);
			iteration++;
			if (iteration >= maxIterations) {
				break;
			}
		}
		return iteration < maxIterations ? value : defaultValue;
	}

	//Math related.
	function distance(posA, posB) {
		var v = { x: posA.x - posB.x, y: posA.y - posB.y };
		return Math.sqrt(v.x * v.x + v.y * v.y);
	}
	function getRandomPosAtDistanceFrom(center, distanceMin, distanceMax, distancePow = 1.0) {
		var angle = Math.random() * Math.PI * 2;
		var random = Math.pow(Math.random(), distancePow);
		var distance = distanceMax * random + distanceMin * (1.0 - random);
		return { x: Math.sin(angle) * distance + center.x, y: Math.cos(angle) * distance + center.y }
	}

	////GLOBAL VARIABLES
	var scene;
	var hive = new JadinkoHive();

	////CONSTANTS, UI AND STUFF

	function getJadinkoTypeLimit() {
		return { Worker: 150, Seedling: 225, Soldier: 45, Drone: 30, Queen: 1, Hive: 451 }[document.querySelector(".val-type").value] || -1;
	}

	var emptyTrait = { name: "None" };
	"wsamfptlcveih".split("").forEach(function (a) {
		emptyTrait[a + "Mult"] = 1.0;
	});

	clampTextboxValue(".val-mutation", 0, 100);
	clampTextboxValue(".val-luminous", 0, 25);
	clampTextboxValue(".val-count", 1, getJadinkoTypeLimit());
	clampTextboxValue(".val-multitrait", -20, 60);

	document.querySelectorAll(".val-mutation, .val-luminous, .val-multitrait, .val-count").forEach(function (textbox) {
		var regex = /^(-?0|-?[1-9]\d*|\b)$|^$/;
		textbox.addEventListener("input", function (event) {
			var target = event.target;
			var input = target.value;
			if (!regex.test(input)) {
				target.value = target.value.slice(0, -1);
			}
		});
		textbox.addEventListener("paste", function (event) {
			var pasteData = event.clipboardData.getData('text');
			if (!regex.test(pasteData)) {
				event.preventDefault();
			}
		});
	});

	document.querySelectorAll(".tabs").forEach(function (container) {
		var tabs = [];
		container.querySelectorAll(".tab").forEach(function (element, i) {
			tabs.push({ element: element, target: document.querySelector(element.getAttribute("data-sel")) });
			element.addEventListener("click", function () {
				selectTab(i);
			});
		});;
		function selectTab(i) {
			tabs.forEach(function (tab, j) {
				tab.element.classList.toggle("tab-active", i == j);
				tab.target.style.display = (i == j) ? "" : "none";
			});
		}
		selectTab(0);
	});

	//Traits stuff.

	function prepTraits(str) {
		str = str.replace(/;/g, "\n").replace(/:/g, ",");
		return str.split("\n").map(function (a) {
			a = a.split(",");
			var result = { name: a[0].trim() };
			"wsamfptlcveih".split("").forEach(function (a) {
				result[a + "Mult"] = 1.0;
			});
			for (var i = 1; i < a.length; i++) {
				var b = ("" + a[i]).trim();
				var what = b[0];
				var value = b.substr(1);
				result[what + "Mult"] = parseFloat(value);
			}
			return result;
		});
	}
	function cleanTraitsWithContradictions(arr, itemsToRemove, cont) {
		itemsToRemove = (Array.isArray(itemsToRemove) ? itemsToRemove : [itemsToRemove]).map(item => item.name);
		var relevantCont = itemsToRemove.concat(...cont.filter(contItem => contItem.find(a => itemsToRemove.includes(a))));
		return arr.filter(arrItem => (!relevantCont.find(contItem => contItem == arrItem.name)));
	}

	var contradictions = `Big Boned:Lithe
Butterface:Handsome
Evil:Good
Fussy Eater:Regular
Genetic Mutation:Good Breeding
Genius:Nice but Dim
Giver:Taker
Immune:Sickly
Insane:Joyful
Limited Efficiency:Robust
Loyal:Surly
Old at Heart:Young at Heart
Plain:Handsome
Producer:Stingy
Sickly:Immune
Slowpoke:Hyperactive
Smelly:Sparkling
Stingy:Producer
Studly:Butterface
Sullen:Jovial
Surly:Loyal
Virile:Sickly
Whimsical:Enigmatic
Constipated:Regular
Genetic Inferiority:Golden Gift
Genetic Instability:Good Breeding
Glistening:Smelly
Golden Gift:Genetic Inferiority
Good Breeding:Genetic Instability
Mysterious:Enigmatic
Perfected:Nice but Dim
Prize Specimen:Freak of Nature
Radiant:Smelly
Stressed:Regular
Strong Genes:Genetic Inferiority
Unlucky for Some:Lucky`.split("\n").map(a => a.split(":"));

	const visualTraitsSlots = [];
	visualTraitsSlots.push(prepTraits(`Missing patches of skin;Parasites:f0.8;Brown lumps on body;Wrinkly skin;Severe scarring
Missing vines:p0.8;Leaking resin:p0.8;Open wounds;Fungal growths;Missing teeth,l0.8;Extra eye
Extra arm;Extra leg;Assymetry;Malignant atavism`));

	visualTraitsSlots.push(prepTraits(`Minor wounds;Discoloration;Missing tailtip:t0.9,l0.9;Overbite:i0.9;Damaged vines:p0.9,t0.9
Extra vines:p0.9,t0.9;Extra finger:i0.9;Extra toe:i0.9;Crooked teeth:i0.9;Mites
Excessive salivation;Longer tongue:i0.9;Shorter tail:t0.9,l0.9;Shorter limbs:t0.9,l0.9;Straighter posture:l0.9,t1.1`));

	visualTraitsSlots.push(prepTraits(`Minor scarring;Dappling on face;Dappling around shoulders;Larger claws;Small horns
Dappling around hips;Neoteny;Quadruped posture;Dappling on thighs;Dewclaws on feet`));

	visualTraitsSlots.push(prepTraits(`Leaves on vines:v1.1,e1.1;Leaves on tail:v1.1,e1.1;Glossy skin;Bright eyes;Toned:c1.1,w1.1
Thicker thighs:s1.1,v1.1;Longer tail;Stronger teeth;Vibrant coloration`));

	visualTraitsSlots.push(prepTraits(`Iridescent skin;Colorful frills;Vivid coloration;Big head frill:p1.2,a1.1,e1.1;Thicker arms:c1.3
Wing-like vine frills;Crown-like headcrest:e1.1;Leaf cape:e1.2;Honey golden eyes;Bioluminescent spots
Feathered leaf margins;Benign atavism`));

	var handicaps = prepTraits(
		`Anxiety:e0.8,i0.9,h0.7;Limp:s0.8,t0.9,l1.1;ADHD:v0.9,e0.8,i0.7;Cataracts:i0.8
Presbycusis:i0.8,e0.7;Dyspraxia:v0.9,e0.8,i0.7;Bradyphrenia:i0.8,e0.7
Muscular Dystrophy:c0.9,s0.8,t0.9;Primary Immune Deficiency:h0.8
Short Term Memory Loss:i0.9,e0.8;Long Term Memory Loss:i0.8,e0.8;Epilepsy:i0.9,e0.8,h0.7
Blindness:i0.8;Deafness:i0.8;Arthritis:c0.9,s0.8,t0.9;Depression:e0.8,i0.9,h0.7;Parkinson's Syndrome:v0.9,e0.8,h0.8`);
	//"wsamfptlcveih"
	var traitsAll = prepTraits(
		`Big Boned:w1.1,l1.2,c1.3;Butterface:w1.1,s1.1,a0.9;Chatty:e1.1
Curvy:w1.1,s0.9,a1.1;Enigmatic:i1.1;Evil:e0.9
Fearless:c1.2;Fussy Eater:w0.9,f0.9;Genetic Mutation:i1.2
Genius:i1.5;Giver:f1.1;Good
Handsome:a1.1;Hyperactive:s1.1,v1.2;Immune:h1.3
Insane:i0.9;Jovial:e1.2;Joyful
Limited Efficiency:c0.9;Lithe:w0.9,s1.1,a1.1,l1.1,v1.2;Lucky:f1.2
Loyal;Nightmare:a0.8,i0.8;Old at Heart:m1.1
Plain:a0.9;Producer:p1.3;Robust:h1.2
Sickly:h0.9;Slowpoke:s0.9,v0.9;Smelly:a0.9
Sparkling;Stingy:f0.9;Studly:t1.3,l1.3,c1.4
Sullen:e0.8;Surly:i0.8;Taker:f0.8
Virile:f1.3,p1.3;Whimsical:i1.2;Young at Heart:m0.9`);

	var traitsSlots = [];
	traitsSlots.push(traitsAll.concat(prepTraits(
		`Constipated:h0.8;Genetic Inferiority:i0.8,h0.8;Regular;Stressed:h0.9`)));

	traitsSlots.push(traitsAll.concat(prepTraits(
		`Charmed;Genetic Inferiority:i0.8,h0.8;Genetic Instability:i0.9
Glistening;Golden Gift;Good Breeding:h1.3
Mysterious:f1.2,i1.1;Perfected:w1.1,s1.1,a1.1,m1.1,f1.1,p1.1,t1.1,l1.1,c1.1,v1.1,e1.1,i1.1,h1.1;Ravensworn:m1.1,e1.2,h1.1
Stressed:h0.9;Strong Genes:i1.2;Unlucky for Some:f0.9,p0.9,h0.9`)));

	traitsSlots.push(traitsAll.concat(prepTraits(
		`Charmed;Exalted:i1.1;Fortunate:l1.1,c1.1
Freak of Nature:l1.2,c1.2,e1.2;Genetic Instability:f0.8,p0.8,t0.8,l0.8,c0.8,e0.9,i0.9,h0.9;Glistening:t1.1,l1.1,c1.1,e1.1,i1.1,h1.1
Golden Gift;Good Breeding;Mysterious:f1.2,i1.1
Nice but Dim:i0.9;Perfected;Prize Specimen:w1.2,s1.2,a1.2,m1.2,f1.2,p1.2,t1.2,l1.2,c1.2,v1.2,e1.2,i1.2,h1.2
Radiant:f1.1;Ravensworn:m1.1,e1.2;Unlucky for Some:f0.9,p0.9,h0,9`)));

	traitsAll.find(a => a.name == "Butterface").aLimitHigh = 1200;
	traitsAll.find(a => a.name == "Handsome").aLimitLow = 1200;
	traitsAll.find(a => a.name == "Nightmare").aLimitHigh = 800;
	traitsAll.find(a => a.name == "Plain").aLimitHigh = 1200;
	traitsAll.find(a => a.name == "Plain").aLimitLow = 800;
	traitsAll.find(a => a.name == "Immune").hLimitLow = 100;

	function pickRandomTrait(traits) {
		return traits[parseInt(Math.random() * traits.length)] || emptyTrait;
	}

	function pickRandomVisualTrait(jadinko, traits) {
		var traitPool = traits[Math.floor(clamp(jadinko.attractiveness, 0, 1999) / 400)];
		var odds = 10 + (0.05 * Math.abs(1000 - jadinko.attractiveness));

		return ((Math.random() < (odds / 100)) ? traitPool[Math.floor(Math.random() * traitPool.length)] : undefined) || emptyTrait;
	}

	function clamp(value, min, max) {
		value = (typeof (min) != "undefined") ? Math.max(value, min) : value;
		value = (typeof (max) != "undefined") ? Math.min(value, max) : value;
		return value;
	}

	//Job stuff.
	var jadinkoJobs = [];
	function addJadinkoJob(jobName, jobRanges) {
		var job = { name: jobName, ranges: {} };
		jobRanges.split(", ").forEach((range, i) => job.ranges[["length", "height", "weight", "speed", "age", "pollenFluid", "liftingCapacity", "iq", "activity"][i]] = range.split("-").map(a => parseFloat(a)));
		jadinkoJobs.push(job);
		return job;
	}
	addJadinkoJob("Worker", "150-180, 75-90, 5000-7000, 15-30, 20-22, 3-11, 4-12, 40-80, 40-50");
	addJadinkoJob("Seedling", "85-100, 55-60, 4000-6000, 8-16, 0-20, 0-0, 1-3, 10-30, 20-30");
	addJadinkoJob("Soldier", "300-350, 150-175, 170000-205000, 12-24, 20-360, 0-0, 200-300, 60-100, 15-25");
	addJadinkoJob("Drone", "300-350, 150-175, 172000-208000, 15-30, 20-360, 67-242, 210-330, 60-90, 15-25");
	addJadinkoJob("Queen", "250-270, 320-350, 500000-700000, 0-0, 360-600, 0-0, 500-700, 80-140, 60-60");
	function findJadinkoJob(jobName) {
		for (var job of jadinkoJobs) {
			if (job.name == jobName) {
				return job;
			}
		}
	}

	//Our chances.
	var workerTypeChances = (`15:Common
7:Shadow
9:Igneous
13:Cannibal
10:Aquatic
10:Amphibious
11:Carrion
12:Diseased
11:Camouflaged
5:Draconic
0.33:Saradomin
0.33:Guthix
0.33:Zamorak`).split("\n").map(function (a) {
		return a.trim().split(":")
	});

	var hiveChances = (`150:Worker
45:Soldier
30:Drone`).split("\n").map(function (a) {
		return a.trim().split(":")
});
	////CARD STUFF
	function outputJadinkoToCards(jadinko) {
		var cards = document.querySelector(".cards-container");
		card = createJadinkoCard(jadinko);
		cards.append(card);
	}

	function createJadinkoCard(jadinko) {
		jadinko = prepareJadinkoForTable(jadinko);
		var row = create(undefined, "div", "card");
		//I am using $ here just to more easily add additional stuff like "Top Speed = ".
		//Also, not using ":$" for those that should be shown raw, the "$" is added automatically later.
		jadinkoDatagridColumns.forEach(function (column) {
			var a = column.split(":");
			var b = a[1].split("@");
			//This adds the second part. It's easier this way than checking their count later.
			if (a.length < 3) {
				a.push("$");
			}
			//a[0] would have strings like "workerType", "trait1", etc. jadinko[a[0]] retrieves the wanted property.
			var cell = create(row, "div", "prop" + ((b.length > 1) ? " num" : ""));
			var cell1 = create(cell, "span", "prop-name");
			var cell2 = create(cell, "span", "prop-value");
			cell1.innerText = b[0] + ": ";
			cell2.innerText = a[2].replace("$", (jadinko[a[0].trim()] === undefined) ? "None" : jadinko[a[0].trim()]);
		});
		row.addEventListener("click", function (e) {
			var sel = window.getSelection();
			var range = document.createRange();
			range.selectNodeContents(this);
			if (!e.shiftKey) {
				sel.removeAllRanges();
			}
			sel.addRange(range);
		});
		return row;
	}

	function clearJadinkoCards() {
		document.querySelectorAll(".cards-container .card").forEach(function (row, i) {
			row.remove();
		});
	}


	////DATAGRID STUFF
	//"@" now means right-aligned.
	var jadinkoDatagridColumns =
		(`age:Age
	job:Type
	traits:Traits
	attractiveness:Attractiveness@
	fertility:Fertility@
	pollenFluid:Pollen Fluid Production@
	handicap:Handicap
	visualTraits:Visual Traits
	height:Height@
	length:Length@
	weight:Weight@
	speed:Top Speed@
	liftingCapacity:Lifting Capacity@
	activity:Activity@:$ min/hr
	energy:Energy@:$ hrs/day
	iq:IQ@
	health:Health@`).split("\n");
	var datagridFirstRow = create(document.querySelector(".datagrid"), "tr", "");
	jadinkoDatagridColumns.forEach(function (column) {
		var a = column.split(":");
		var b = a[1].split("@");
		var cell = create(datagridFirstRow, "th", "");
		cell.innerText = b[0];
	});
	function prepareJadinkoForTable(jadinko) {
		var result = {};
		var healthTraits = `20:Weight loss
30:Vomiting
40:Coughing
50:Sneezing
60:Runny nose
70:Eye/ear discharge
40:Skin infection
50:Swelling
30:Anemia
40:Abscesses
60:Discharge from orifices`.split("\n").map(a => a.split(":"));
		var looks = `2100:Perfect
2000:Divine
1900:Stunning
1700:Gorgeous
1500:Beautiful
1300:Good Looking
1100:Attractive
900:Average
700:Ordinary
500:Below Average
300:Unattractive
100:Ugly
0:Hideous`.split("\n").map(a => a.split(":"));
		result.job = ((jadinko.isMutated ? "Mutated " : "") + jadinko.gender + " " + (jadinko.job.name == "Seedling" ? "Seedling\n(" + jadinko.jobAffinity.name + (jadinko.jobAffinity.name == "Worker" ? ", " + jadinko.workerType : "") + ")" : jadinko.job.name + (jadinko.job.name == "Worker" ? ", " + jadinko.workerType : "")));
		result["traits"] = jadinko.traits.filter(a => a.name != "None").map(trait => "• " + trait.name).join("\n") || "None";
		result["handicap"] = jadinko.handicap.name;
		result["visualTraits"] = jadinko.visualTraits.filter(a => a.name != "None").map(trait => "• " + trait.name).join("\n") || "None";
		["gender", "pollenFluid"].forEach(a => result[a] = jadinko[a]);
		["age", "length", "height", "weight", "speed", "energy", "liftingCapacity", "iq", "activity"].forEach(function (a) {
			result[a] = parseInt(jadinko[a]);
		});
		result["attractiveness"] = looks.filter(a => jadinko.attractiveness >= parseInt(a[0])).map(a => a[1])[0];
		result["health"] = healthTraits.filter(a => jadinko.health < a[0]).map(a => "• " + a[1]).join("\n") || "• Healthy"
		result["fertility"] = jadinko.fertility.toFixed(0) + (jadinko.pregnant ? "% (Pregnant)" : "%");
		result["age"] = (result["age"] < 30) ? (result["age"] + " months") : ((result["age"] / 12).toFixed(0) + " years");
		result["weight"] = (jadinko["weight"] / 1000).toFixed(3);
		var isMetric = document.querySelector(".val-metric").checked;
		result["height"] = isMetric ? result["height"] + " cm" : cmToFeetAndInches(result["height"]);
		result["length"] = isMetric ? result["length"] + " cm" : cmToFeetAndInches(result["length"]);
		result["weight"] = isMetric ? result["weight"] + " kg" : (result["weight"] * 2.20462).toFixed(3) + " lbs";
		result["speed"] = isMetric ? result["speed"] + " km/h" : parseInt(result["speed"] * 0.621371) + " mph"
		result["pollenFluid"] = !jadinko.fertileMale ? "" : result["pollenFluid"].toFixed(1) + " mL";
		result["liftingCapacity"] = isMetric ? result["liftingCapacity"] + " kg" : (result["weight"] * 2.20462).toFixed(3) + " lbs";
		if (jadinko.job.name == "Queen")
			result["weight"] = "Unknown";
		return result;
	}
	function clearJadinkoDatagrid() {
		document.querySelectorAll(".datagrid tr").forEach(function (row, i) {
			if (i > 0) {
				row.remove();
			};
		});
	}
	function outputJadinkoToDatagrid(jadinko) {
		jadinko = prepareJadinkoForTable(jadinko);
		var datagrid = document.querySelector(".datagrid");
		var row = create(datagrid, "tr", "");
		//I am using $ here just to more easily add additional stuff like "Top Speed = ".
		//Also, not using ":$" for those that should be shown raw, the "$" is added automatically later.
		jadinkoDatagridColumns.forEach(function (column) {
			var a = column.split(":");
			var b = a[1].split("@");
			//This adds the second part. It's easier this way than checking their count later.
			if (a.length < 3) {
				a.push("$");
			}
			//a[0] would have strings like "workerType", "trait1", etc. jadinko[a[0]] retrieves the wanted property.
			var valueToShow = a[2].replace("$", (jadinko[a[0].trim()] === undefined) ? "None" : jadinko[a[0].trim()]);
			var cell = create(row, "td", (b.length > 1) ? "num" : "");
			cell.innerText = valueToShow;
		});
	}

	////SCENE
	function Scene() {
		this.canvas = document.querySelector(".scene");
		this.canvasCenter = { x: this.canvas.width / 2.0, y: this.canvas.height / 2.0 };
		this.pos = { x: this.canvasCenter.x, y: this.canvasCenter.y };
		this.context = this.canvas.getContext("2d");
		this.zoomRaw = 1.0;
		this.zoom = 1.0;
		this.settings = {};
		this.updatePos();
	}
	Scene.prototype.resetPos = function () {
		this.pos = { x: this.canvasCenter.x, y: this.canvasCenter.y };
		this.zoomRaw = 1.0;
		this.zoom = 1.0;
		this.updatePos();
	}
	Scene.prototype.updatePos = function () {
		//I really don't understand this. Seems to work.. Somehow...
		this.drawOff1 = { x: -this.pos.x, y: -this.pos.y };
		this.drawOff2 = { x: this.canvasCenter.x, y: this.canvasCenter.y };
	}
	scene = new Scene();

	////SCENE, CONTROLS
	document.querySelector(".scene").addEventListener("wheel", function (event) {
		scene.zoomRaw = Math.max(scene.zoomRaw + -event.deltaY / 1000.0, 0.3);
		scene.zoom = Math.pow(scene.zoomRaw, 2);
		event.preventDefault();
		drawScene();
	});
	document.querySelector(".scene").addEventListener("mousedown", function (event) {
		if (event.button == 0) {
			var startM = { x: event.pageX, y: event.pageY };
			var startPos = { x: scene.pos.x, y: scene.pos.y };
			function move(event) {
				var diff = { x: event.pageX - startM.x, y: event.pageY - startM.y };
				scene.pos.x = startPos.x - diff.x / scene.zoom;
				scene.pos.y = startPos.y - diff.y / scene.zoom;
				scene.updatePos();
				drawScene();
			}
			document.addEventListener("mousemove", move);
			document.addEventListener("mouseup", function () {
				document.removeEventListener("mousemove", move);
			});
		}
		if (event.button == 1) {
			event.preventDefault();
			scene.resetPos();
			drawScene();
		}
	});
	document.querySelector(".val-healthbar").addEventListener("change", function () {
		scene.settings.health = this.checked;
		drawScene();
	});
	scene.settings.health = document.querySelector(".val-healthbar").checked;
	var floatingCard;
	window.addEventListener("click", function () {
		if (floatingCard) {
			var sel = window.getSelection();
			var range = document.createRange();
			range.selectNodeContents(floatingCard);
			sel.removeAllRanges();
			sel.addRange(range);
		}
	});
	var lastJadinko;
	function setJadinkoHovered(jadinko, pos, rawPos) {
		if (jadinko == lastJadinko) {
			if (floatingCard) {
				floatingCard.style.transform = `translate(${rawPos.x}px, ${rawPos.y}px)`;
			}
			return;
		}
		if (floatingCard) {
			floatingCard.remove();
			floatingCard = false;
		}
		if (lastJadinko) {
			lastJadinko.isHovered = false;
		}
		lastJadinko = jadinko;
		if (jadinko) {
			jadinko.isHovered = true;
			floatingCard = createJadinkoCard(jadinko);
			floatingCard.classList.add("floating");
			floatingCard.style.transform = `translate(${rawPos.x}px, ${rawPos.y}px)`;
			document.body.append(floatingCard);
		}
		drawScene();
	}
	window.addEventListener("mousemove", function (event) {
		sceneAnalyzeMouseEvent(event);
	});
	function sceneAnalyzeMouseEvent(event) {
		var isAtScene = event.target.classList.contains("scene");
		var rawPos = { x: event.pageX, y: event.pageY };
		var rect = scene.canvas.getBoundingClientRect();
		var scenePos = {};
		scenePos.x = (rawPos.x - rect.left) / rect.width * scene.canvas.width;
		scenePos.y = (rawPos.y - rect.top) / rect.height * scene.canvas.height;
		//Now it's in the range of 0-scene.canvas.width, etc
		scenePos.x = (scenePos.x - scene.drawOff2.x) / scene.zoom - scene.drawOff1.x;
		scenePos.y = (scenePos.y - scene.drawOff2.y) / scene.zoom - scene.drawOff1.y;
		scenePos.isInside = isAtScene;
		sceneOnMousePosMove(scenePos, rawPos);
	}
	function sceneOnMousePosMove(pos, rawPos) {
		if (pos.isInside) {
			var theJadinko;
			for (var i = hive.jadinkos.length - 1; i >= 0; i--) {
				var jadinko = hive.jadinkos[i];
				var d = distance(pos, jadinko.pos);
				var visualJadinkoRadius = 0.1 * jadinko.height;
				if (d < (2 + visualJadinkoRadius)) {
					theJadinko = jadinko;
					break;
				}
			}
			setJadinkoHovered(theJadinko, pos, rawPos);
		} else {
			setJadinkoHovered(undefined, pos);
		}
	}

	////SCENE, RENDERING
	function drawScene() {
		clearScene();
		drawHive(hive);
	}

	function clearScene() {
		scene.context.clearRect(0, 0, scene.canvas.width, scene.canvas.height);
	}
	function sceneDrawSomething(scene, width, color = "#000", alpha = 1.0) {
		scene.context.globalAlpha = alpha;
		if (width == "f") {
			scene.context.fillStyle = color;
			scene.context.fill();
		} else {
			scene.context.lineWidth = width;
			scene.context.strokeStyle = color;
			scene.context.stroke();
		}
		scene.context.globalAlpha = 1.0;
	}
	function sceneDrawArc(scene, x, y, radius, start, end, width, color = "#000", alpha = 1.0, ignoreZoomScale = false) {
		x = (x + scene.drawOff1.x) * scene.zoom + scene.drawOff2.x;
		y = (y + scene.drawOff1.y) * scene.zoom + scene.drawOff2.y;
		radius *= ignoreZoomScale ? 1.0 : scene.zoom;
		scene.context.beginPath();
		scene.context.arc(x, y, radius, 2 * Math.PI * start, 2 * Math.PI * end);
		sceneDrawSomething(scene, width, color, alpha);
	}
	function sceneDrawRect(scene, x, y, w, h, width, color = "#000", alpha = 1.0, ignoreZoomScale = false) {
		x = (x + scene.drawOff1.x) * scene.zoom + scene.drawOff2.x;
		y = (y + scene.drawOff1.y) * scene.zoom + scene.drawOff2.y;
		w *= ignoreZoomScale ? 1.0 : scene.zoom;
		h *= ignoreZoomScale ? 1.0 : scene.zoom;
		scene.context.beginPath();
		scene.context.rect(x, y, w, h);
		sceneDrawSomething(scene, width, color, alpha);
	}
	function drawHive(hive) {
		sceneDrawArc(scene, hive.center.x, hive.center.y, hive.size, 0, 1, "f", "#F8F8F8");
		sceneDrawArc(scene, hive.center.x, hive.center.y, hive.size, 0, 1, 5, "#F0F0F0");
		sceneDrawArc(scene, hive.entrance.x, hive.entrance.y, 20.0, 0, 1, 3, "#000");
		drawJadinkos(hive.jadinkos);
	}

	function drawJadinkos(jadinkos) {
		var c = document.querySelector(".scene").getContext("2d");
		//Jadinkos
		jadinkos.forEach(function (jadinko) {
			//scene.context.globalAlpha = 1.0;
			//scene.context.beginPath();
			var colors = {
				Male: { Default: "#000", Seedling: "#484", Queen: "#808", Drone: "#88F", Soldier: "#FF3000" },
				Female: { Default: "#444", Seedling: "#6A6", Queen: "#808", Drone: "#88F", Soldier: "#FF3000" },
				Herm: { Default: "#222", Seedling: "#505", Queen: "#505", Drone: "#B0B0FF", Soldier: "#FF6347" }
			};
			var gender = (["Male", "Female", "Herm"].indexOf(jadinko.gender) != -1) ? jadinko.gender : "Male";
			sceneDrawArc(scene, jadinko.pos.x, jadinko.pos.y, 0.1 * jadinko.height, 0, 1, "f", colors[gender][jadinko.job.name] || colors[gender]["Default"] || colors["Male"]["Default"], jadinko.isHovered ? 0.75 : 1.0);
			if (jadinko.isHovered) {
				sceneDrawArc(scene, jadinko.pos.x, jadinko.pos.y, 0.1 * jadinko.height, 0, 1, 3.0, "#000", 0.2);
			}
			if (jadinko.isMutated) {
				sceneDrawArc(scene, jadinko.pos.x, jadinko.pos.y, 0.1 * jadinko.height, 0, 1, 3.0, "#840");
			}
		});
		//Jadinkos' health
		if (scene.settings.health) {
			jadinkos.forEach(function (jadinko) {
				var h = 2.0 / scene.zoom;
				var ry = jadinko.pos.y - (0.1 * jadinko.height) - 8.0 / scene.zoom + h / 2.0;
				var rw = 20.0 / scene.zoom;
				var rw2 = rw * jadinko.health / 100.0;
				var rx = jadinko.pos.x - rw / 2.0;
				var rx2 = jadinko.pos.x - rw2 / 2.0;
				sceneDrawRect(scene, rx, ry, rw, h, "f", "#888");
				sceneDrawRect(scene, rx, ry, rw2, h, "f", "#800");
				sceneDrawRect(scene, rx, ry, rw2, h, "f", "#0F0", Math.min(jadinko.health / 100.0 * 0.8, 1.0));
				sceneDrawRect(scene, rx + rw, ry, 1.0 / scene.zoom, h, "f", "#222");
			});
		}
	}

	////HIVE OBJECT

	function JadinkoHive() {
		this.jadinkos = [];
		this.center = { x: 400.0, y: 400.0 }
		this.size = 400.0;
		this.rooms = {}; //It's an object, so properties can be referenced by names. Perhaps there should be multiple nurseries later...
		this.rooms.nursery = { x: 170, y: 600, size: 100.0 }
		this.rooms.queensChamber = { x: 400, y: 650, size: 200.0 }
		var entranceRandomness = 400.0;
		this.entrance = { x: (Math.random() - 0.5) * entranceRandomness + this.center.x, y: 80.0 }
	}
	JadinkoHive.prototype.isPosDangerousForMutated = function (pos) {
		if ((distance(pos, this.rooms.nursery) < this.rooms.nursery.size) || (distance(pos, this.rooms.queensChamber) < this.rooms.queensChamber.size)) {
			return true;
		}
		for (jadinko of this.jadinkos) {
			if ((jadinko.job.name == "Soldier") && (!jadinko.isMutated) && (distance(pos, jadinko.pos) < 80.0)) {
				return true;
			}
		}
		return false;
	}
	JadinkoHive.prototype.hideMutated = function () {
		for (var mutatedJadinko of this.jadinkos) {
			if ((!mutatedJadinko.isMutated) || (mutatedJadinko.job.name == "Queen")) {
				continue; //It's not mutated. Go away, healthy one!..
			}
			//Limiting attempts. Because otherwise it might freeze.
			for (var i = 0; i < 50; i++) {
				if (!this.isPosDangerousForMutated(mutatedJadinko.pos)) {
					break; //Safe!
				}
				mutatedJadinko.pos = getRandomPosAtDistanceFrom({ x: 400.0, y: 400.0 }, 0.0, 1200.0, 1.0);
			}
		}
	}
	JadinkoHive.prototype.addJadinko = function (jadinko) {
		this.jadinkos.push(jadinko);
		jadinko.hive = this;
		var r = getRandomPosAtDistanceFrom({ x: 400.0, y: 400.0 }, 0.0, 400.0, 0.5);
		jadinko.pos = { x: r.x, y: r.y }
		if (jadinko.job.name == "Seedling") {
			var room = (Math.random() < 0.6) ? this.rooms.nursery : this.rooms.queensChamber;
			var r = getRandomPosAtDistanceFrom({ x: room.x, y: room.y }, 0.0, room.size * 0.8, 8);
			jadinko.pos = { x: r.x, y: r.y }
		}
		if ((jadinko.job.name == "Worker") && (Math.random() < 0.7)) {
			var r = getRandomPosAtDistanceFrom({ x: 400.0, y: 400.0 }, 0.0, 800.0, 0.3);
			jadinko.pos = { x: r.x, y: r.y };
		}
		if ((jadinko.job.name == "Worker")) {
			if (Math.random() < 0.7) {
				jadinko.pos = getRandomPosAtDistanceFrom(this.rooms.queensChamber, 0.0, 100.0, 0.5);
			}
			if (Math.random() < 0.7) {
				jadinko.pos = getRandomPosAtDistanceFrom({ x: 400.0, y: 400.0 }, 0.0, 800.0, 0.3);
			}
		}
		if ((jadinko.job.name == "Soldier") && (Math.random() < 0.1)) {
			jadinko.pos = getRandomPosAtDistanceFrom(this.entrance, 0.0, 80.0, 0.5);
		}
		if (jadinko.job.name == "Drone") {
			if (Math.random() < 0.80) { //20% total
				jadinko.pos = getRandomPosAtDistanceFrom(this.rooms.nursery, 0.0, this.rooms.nursery.size * 0.5, 0.5);
			}
			if (Math.random() < 0.75) { //75% total, 25% for what is above
				jadinko.pos = getRandomPosAtDistanceFrom(this.rooms.queensChamber, 0.0, this.rooms.queensChamber.size * 0.5, 0.5);
			}
		}
		if (jadinko.job.name == "Queen") {
			jadinko.pos = getRandomPosAtDistanceFrom({ x: 400.0, y: 755.0 }, 0.0, 10.0, 1.0)
		}
	}

	////JADINKO OBJECT
	function updateJadinkoGender(jadinko, gender) {
		if ((Math.random() <= 0.001) || (gender == "Herm")) {
			jadinko.gender = "Herm";
			return; //No "else" then, somewhat cleaner.
		}
		switch (jadinko.jobAffinity.name) {
			case "Queen":
				jadinko.gender = "Female";
				break;
			case "Drone":
			case "Soldier":
				jadinko.gender = "Male";
				break;
			default:
				jadinko.gender = (gender != "Random") ? gender : (Math.random() <= 0.5) ? "Male" : "Female";
		}
	}

	function Jadinko(inputData) {
		var jadinko = this;
		var traitsSlotsDuplicate = traitsSlots.slice().map(a => a.slice());
		jadinko.baseType = inputData.type;
		jadinko.job = findJadinkoJob(inputData.type) || jadinkoJobs[1];
		jadinko.jobAffinity = (jadinko.job.name == "Seedling") ? findJadinkoJob(getRandomWithProbabilities(hiveChances.concat([[0.045, "Queen"]]))) : jadinko.job;
		//Should turn into actual worker type, not just a string.
		jadinko.workerType = (inputData.breed != "Random") ? inputData.breed : getRandomWithProbabilities(workerTypeChances.concat([[0.097 * parseFloat(1 + ((inputData.luminous) * 0.01)), "Luminous"]]));
		jadinko.traits = [pickRandomTrait(traitsSlotsDuplicate[0]), emptyTrait, emptyTrait];
		if (Math.random() * (10 - (inputData.multitrait / 100)) <= 1) {
			traitsSlotsDuplicate[1] = cleanTraitsWithContradictions(traitsSlotsDuplicate[1], jadinko.traits[0], contradictions);
			traitsSlotsDuplicate[2] = cleanTraitsWithContradictions(traitsSlotsDuplicate[2], jadinko.traits[0], contradictions);
			jadinko.traits[1] = pickRandomTrait(traitsSlotsDuplicate[1]);
			if (Math.random() * (10 - (inputData.multitrait / 100)) <= 1) {
				traitsSlotsDuplicate[2] = cleanTraitsWithContradictions(traitsSlotsDuplicate[2], jadinko.traits[1], contradictions);
				jadinko.traits[2] = pickRandomTrait(traitsSlotsDuplicate[2]);
			}
		}
		var handicapsDuplicate = cleanTraitsWithContradictions(handicaps.slice(), jadinko.traits, contradictions);
		jadinko.handicap = (Math.random() * (125 - (inputData.multitrait / 100)) <= 1) ? pickRandomTrait(handicapsDuplicate) : emptyTrait;
		jadinko.age = mapRandom(...jadinko.job.ranges.age);
		jadinko.length = mapRandom(...jadinko.job.ranges.length);
		jadinko.height = mapRandom(...jadinko.job.ranges.height);
		jadinko.weight = mapRandom(...jadinko.job.ranges.weight);
		jadinko.weight *= (jadinko.job.name == "Seedling") ? ({ Soldier: 3, Drone: 3, Queen: 6 }[jadinko.jobAffinity.name] || 1) : 1;
		jadinko.speed = mapRandom(...jadinko.job.ranges.speed);
		updateJadinkoGender(jadinko, inputData.gender);
		jadinko.canBePregnant = (jadinko.gender != "Male") && (jadinko.job.name != "Seedling" && jadinko.job.name != "Soldier");
		jadinko.fertility = (jadinko.job.name != "Seedling" && jadinko.job.name != "Soldier") ? (jadinko.job.name == "Queen") ? Math.max(generateValue(200, 100).toFixed(0), 50) : generateValue(200, 100).toFixed(0) : 0;
		jadinko.attractiveness = mapRandom(0, 2001);
		jadinko.liftingCapacity = mapRandom(...jadinko.job.ranges.liftingCapacity);
		jadinko.iq = mapRandom(...jadinko.jobAffinity.ranges.iq);
		jadinko.energy = generateValue(25, 16).toFixed(0);
		jadinko.activity = mapRandom(...jadinko.job.ranges.activity);
		jadinko.fertileMale = (jadinko.gender != "Female") && (jadinko.job.name != "Seedling" && jadinko.job.name != "Soldier");
		jadinko.health = Math.max(generateValue(200, 100).toFixed(0), 1);
		jadinko.health *= jadinko.attractiveness / 1000;
		jadinko.isMutated = ((Math.random() * 100) < inputData.mutation) && !jadinko.traits.find(a => a.name == "Immune") ? true : false;
		while (jadinko.traits.find(a => a.name == "Immune" && jadinko.workerType == "Diseased"))
			jadinko.workerType = getRandomWithProbabilities(workerTypeChances.concat([[0.097 * parseFloat(1 + ((inputData.luminous) * 0.01)), "Luminous"]]));
		jadinko.attractiveness *= (jadinko.workerType == "Diseased" ? 0.5 : 1) * (jadinko.isMutated ? 0.2 : 1);
		if (jadinko.workerType == "Diseased")
			jadinko.health = Math.min(jadinko.health, 50);
		jadinko.pollenFluid = jadinko.fertileMale ? mapRandom(...jadinko.job.ranges.pollenFluid) : 0;
		jadinko.pregnant = jadinko.canBePregnant && (jadinko.job.name == "Queen" || Math.random() < (((1 + jadinko.attractiveness * 0.04) * (jadinko.fertility / 100) / 800)));
		if (jadinko.job.name == "Queen")
			jadinko.health *= 1.05;
		if (jadinko.pregnant && jadinko.job.name != "Queen") {
			jadinko.speed *= 0.8;
			jadinko.energy *= 0.9;
			jadinko.weight *= 1.2;
			jadinko.health *= 1.05;
			jadinko.activity *= 0.95;
			jadinko.liftingCapacity *= 0.9;
		}
		if (jadinko.traits.find(a => a.name == "Genius"))
			jadinko.iq = Math.max(jadinko.iq, (jadinko.jobAffinity.ranges.iq[0] + jadinko.jobAffinity.ranges.iq[1]) / 2);
		if (jadinko.traits.find(a => a.name == "Nice but Dim"))
			jadinko.iq = Math.min(jadinko.iq, (jadinko.jobAffinity.ranges.iq[0] + jadinko.jobAffinity.ranges.iq[1]) / 2);
		jadinko.traits.concat([jadinko.handicap]).forEach(function (trait) {
			"speed=s,weight=w,attractiveness=a,age=m,fertility=f,pollenFluid=p,height=t,length=l,liftingCapacity=c,activity=v,energy=e,iq=i,health=h".split(",").map(a => a.split("=")).forEach(function (a) {
				jadinko[a[0]] = clamp(jadinko[a[0]], trait[a[1] + "LimitLow"], trait[a[1] + "LimitHigh"]);
				jadinko[a[0]] *= trait[a[1] + "Mult"];
			});

		});
		var vTraitsSlotsDuplicate = cleanTraitsWithContradictions(visualTraitsSlots.slice().map(a => a.slice()), jadinko.traits.concat([jadinko.handicap]), contradictions);
		jadinko.visualTraits = [emptyTrait, emptyTrait, emptyTrait];
		for (var i = 0; i < 3; i++) {
			jadinko.visualTraits[i] = pickRandomVisualTrait(jadinko, vTraitsSlotsDuplicate);
			vTraitsSlotsDuplicate = vTraitsSlotsDuplicate.map(vTraits => cleanTraitsWithContradictions(vTraits, jadinko.visualTraits[i], contradictions));
			if (jadinko.visualTraits[i].name == "None") {
				break;
			}
		}
		jadinko.visualTraits.forEach(function (trait) {

			"speed=s,weight=w,attractiveness=a,age=m,fertility=f,pollenFluid=p,height=t,length=l,liftingCapacity=c,activity=v,energy=e,iq=i,health=h".split(",").map(a => a.split("=")).forEach(function (a) {
				jadinko[a[0]] = clamp(jadinko[a[0]], trait[a[1] + "LimitLow"], trait[a[1] + "LimitHigh"]);
				jadinko[a[0]] *= trait[a[1] + "Mult"];
			});

		});
		jadinko.energy = Math.min(jadinko.energy, 24);
		jadinko.activity = Math.min(jadinko.activity, 60);
		return jadinko;
	}

////GENERATE BUTTON

	//Here is what happens when the button is pressed
	document.querySelector(".confirm").addEventListener("click", function () {
		var inputData = {}

		function prepareInputData(propName, selector, def = "") {
			//This gets the value or the default.
			inputData[propName] = document.querySelector(selector).value || def;
		}
		prepareInputData("count", ".val-count");
		prepareInputData("type", ".val-type");
		prepareInputData("gender", ".val-gender");
		prepareInputData("breed", ".val-breed");
		prepareInputData("luminous", ".val-luminous");
		prepareInputData("multitrait", ".val-multitrait");
		prepareInputData("mutation", ".val-mutation");

		clearJadinkoDatagrid();
		clearJadinkoCards();
		hive = new JadinkoHive();
		if (inputData.type != "Hive") {
			for (var i = 0; i < inputData.count; i++) {
				hive.addJadinko(new Jadinko(inputData));
			}
		} else {
			for (var i = 0; i < inputData.count; i++) {
				inputData.type = (i == 0) ? "Queen" : getRandomWithProbabilities(hiveChances.concat([[225, "Seedling"]]));
				hive.addJadinko(new Jadinko(inputData));
			}
		}
		hive.hideMutated();
		hive.jadinkos.forEach(function (jadinko) {
			outputJadinkoToDatagrid(jadinko);
			outputJadinkoToCards(jadinko);
		});
		scene.resetPos();
		drawScene();
	});
});