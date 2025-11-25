var MODE = 'dev';
//var MODE = 'live';

var refidUrl = 'a11-14612773301141_47-31021982484196'
if (MODE != 'dev'){
  refidUrl = ui.url.get('refid');
}

var DEVICE;
ui.root.onResize(function(dev){
  if (dev.is_desktop){
    DEVICE = 'is_desktop';
  } else {
    DEVICE = 'is_mobile';
  }
})
if (MODE == 'dev'){
  DEVICE = 'is_desktop'
}


var deviceDict = {
  is_desktop: {
    splitPanelDirection: 'horizontal',
    subMapHeight: '200px',
    subMapWidth: '200px'
  },
  is_mobile: {
    splitPanelDirection: 'vertical',
    subMapHeight: '200px',
    subMapWidth: '200px'
  }
}



/*
  // Setup global objects ///////////////////////////////////////////////////////////////////////////
*/ 
// Samples to process
var samplesPilot = ee.FeatureCollection('projects/nina/Arena/Sampling/pilot_sample');
var samples = ee.FeatureCollection('projects/nina/Arena/Sampling/samples_for_app_countries_v1')
var samples = ee.FeatureCollection('projects/nina/Arena/Sampling/samples_for_app_combined_v1')
samples= samples.merge(samplesPilot)
print(samples.limit(10))

var sampleSelect = samples.filter(ee.Filter.eq('PLOTID', refidUrl)).first();
sampleSelect= ee.Feature(sampleSelect)

// LUCAS
var lucas = ee.FeatureCollection("JRC/LUCAS_HARMO/THLOC/V1")
  .filter(ee.Filter.eq('year', 2018))
  .filter(ee.Filter.eq('letter_group', 'A'));
print(lucas.size())

var lucasLookup = {
  "Agriculture": ["U111"],
  "Forestry": ["U120"],
  "Aquaculture and Fishing": ["U130"],
  "Mining and Quarrying": ["U140"],
  "Energy Production": ["U210", "U319"],
  "Industry and Manufacturing": ["U221", "U222", "U223", "U224", "U225", "U226", "U227", "U228"],
  "Transport, Communication Networks, and Logistics": ["U311", "U312", "U313", "U314", "U315", "U316", "U317"],
  "Water and Waste Treatment": ["U321", "U322"],
  "Commerce and Services": ["U340", "U341", "U342"],
  "Community Services": ["U350"],
  "Recreation, Leisure, and Sports": ["U361", "U362", "U363"],
  "Residential": ["U370"]
};
// Minimum buffer size for ground truth collection
var minBuff = 50 // km

// Text and panel styles
var titleStyle = {fontFamily:'cormorantgaramond-light', fontSize:'22px',color:'#000000',  backgroundColor: '#ffffff',  margin:'2px'};
var headingStyle = {fontFamily:'cormorantgaramond-light', fontSize:'20px', color:'#000000',backgroundColor: '#ffffff',  margin:'2px'};
var textStyle = {fontFamily:'monospace', fontSize:'11px', color:'#322220',backgroundColor: '#ffffff', padding:'2px', margin:'2px'};
var textStyleGrey = {fontFamily:'monospace', fontSize:'11px', color:'#322220',backgroundColor: '#e8e8e8', padding:'2px', margin:'2px'};
var textStyleQuestion = {fontFamily:'monospace', fontSize:'11px', color:'#322220',backgroundColor: '#ffffff', padding:'8px 2px 2px 2px'};
var textStyleBold = {fontFamily:'monospace', fontSize:'11px', color:'#322220',backgroundColor: '#ffffff', fontWeight: 'bold', padding:'2px', margin:'2px'};
var textStyleEmphasis = {fontFamily:'monospace', fontSize:'13px',textDecoration: 'underline', color:'#322220',backgroundColor: '#ffffff'};
var textStyleWarning = {fontFamily:'monospace', fontSize:'12px', color:'#c87cff',backgroundColor: '#ffffff', fontWeight: 'bold',  padding:'2px', margin:'2px'};
var textWhite = {fontFamily:'monospace','background-color': '#00000000', color:'#ffffff', fontSize: '13px',padding:'2px', margin:'2px'}

// Land cover typology descriptions dictionary
var lcTypologyDict = {
  "Agriculture": "Built-up expansion associated with crop production, animal husbandry, and associated activities. Examples include crop cultivation greenhouses or tunnels, agricultural warehouses or storage facilities, infrastructure for raising livestock, and equipment storage areas or agricultural waste disposal areas.",
  "Forestry": "Built-up expansion associated with growing timber, coppices, and forest products. Activities include planting, thinning, logging, and the storage of raw timber. Examples include forestry tracks and roads, timber processing plants, timber storage areas.",
  "Mining and Quarrying": "Built-up expansion associated with the extraction of minerals, petroleum, natural gas, and other geological resources. Includes quarries for stone, sand, and gravel, as well as mining activities for coal, ores, and peat extraction.",
  "Energy Production": "Built-up expansion associated with producing electricity, steam, and other forms of energy. Includes renewable energy facilities like wind and solar farms, fossil fuel plants, and hydropower stations, as well as biogas production sites.",
  "Industry and Manufacturing": "Built-up expansion associated with the processing of raw materials and manufacturing products. Examples: food and beverage production facilities, textile factories, machinery manufacturing, chemical plants, wood-based product manufacturing, and printing and reproduction. Subcategories cover raw industries (e.g., smelting), heavy industries (e.g., vehicle production), and light industries (e.g., consumer goods).",
  "Transport, Communication Networks, and Logistics": "Built-up expansion associated with road, rail, air, and water transport, as well as pipelines and telecommunication networks. Includes parkng areas, airports, harbors, railway stations, and storage facilities for goods.",
  "Water and Waste Treatment": "Built-up expansion associated with water supply and treatment facilities, sewer systems, and waste management plants. Examples include reservoirs, sewage treatment plants, and recycling centers.",
  "Commerce and Services":"Built-up expansion associated with commercial activities like retail stores, offices, financial institutions, and professional services. Examples: shopping centers, banks, and office parks.",
  "Community Services":"Built-up expansion associated with public institutions, such as schools, hospitals, police stations, and administrative offices. Examples: town halls, law courts, and public libraries.",
  "Recreation, Leisure, and Sports": "Built-up expansion associated with parks, sports fields, amusement parks, and other areas for recreational or leisure activities. Examples: built-up surfaces in golf courses, swimming pools, and playgrounds.",
  "Residential": "Built-up expansion associated with housing and residential purposes. Includes single-family homes, apartment complexes, recreational cabins, and mixed-use residential-commercial areas.",
  "": ""
};

/***
 * UI Widgets ----------------------------------------------------------------------------------
 */

// Main panel
var infoPanel = ui.Panel({
  style: {
    position:'top-center',
    maxHeight: '400px',
    //maxWidth: '400px',
    width:'45%'
  }
});

// Map examples panel
var examplesPanel = ui.Panel({
  style: {
    position:'top-center',
    maxHeight: '400px',
  },
  layout: ui.Panel.Layout.Flow('horizontal') 
});

// Title text
var textTitle = ui.Label('Arena green to grey land use driver CRIB SHEET', titleStyle)

// Context texts
var textSampleId = ui.Label('Showing ground truths surrounging: ' + String(refidUrl), textStyleBold);

// Context info panel
var sampleInfoPanel = ui.Panel();
sampleInfoPanel
  .add(textSampleId)
  
// Remind limitations
var reminderPanel = ui.Panel();
reminderPanel
  .add(ui.Label('NB: please rememeber some points may deviated from true location, or land use may be outdated', textStyleWarning))
  
// Instruc text
var textInstruc = ui.Label('Find ground truth examples for: ', textStyleQuestion)
var selectorLC = ui.Select({
  items: Object.keys(lcTypologyDict), 
  placeholder: '',
  value: '',
  onChange:collectGroundTruthMaps
})
var textPanelLC = ui.Panel({
  widgets: [textInstruc, selectorLC],
  layout: ui.Panel.Layout.Flow('horizontal') 
})

var textLCdescription = ui.Label('', textStyleGrey)

//  LC types panel
var lcTypesPanel = ui.Panel();
lcTypesPanel
  .add(textPanelLC)
  .add(textLCdescription)


// Lucas map panel
var groundTruthPanel = ui.Panel();

// Ground truth instruction
var textGroundTruth = ui.Label('Define the radius of the search area for ground truth examples: ', textStyle)

// Radius slider
var sliderRadius = ui.Slider({
  min: minBuff,
  max:600, 
  value:50, 
  step:50, 
  //onChange:ui.util.debounce(function(val){print(val)},1000),
  onChange:ui.util.debounce(collectGroundTruthMaps,1000),
  style:{width:'150px'}
})

// Ground truth map
var mapGroundTruth = ui.Map({style:{height:'250px', width:'250px'}})
mapGroundTruth.centerObject(sampleSelect, 10)
mapGroundTruth.setOptions('HYBRID')
mapGroundTruth.setControlVisibility({
  mapTypeControl:false, 
  layerList: false, 
  fullscreenControl: false
});

// Ground truth layer and buffer
mapGroundTruth.layers().add(ui.Map.Layer(lucas.style({pointSize:2, color:'#ed02f0'})))
var buffToMap = ee.FeatureCollection([sampleSelect.buffer(minBuff*1000)])
mapGroundTruth.layers().add(ui.Map.Layer(buffToMap.style({fillColor:'#00000000', color:'#32c2c8'})))



groundTruthPanel
  .add(textGroundTruth)
  .add(sliderRadius)
  .add(mapGroundTruth)


/***
 * UI deploy ----------------------------------------------------------------------------------
 */



// Create a split panel with the two panels
var splitPanel = ui.SplitPanel({
  firstPanel: infoPanel,
  secondPanel: examplesPanel,
  orientation: deviceDict[DEVICE]['splitPanelDirection'],
  wipe: false,
  //style:{maxWidth: '500px'}
});

infoPanel
  .add(textTitle)
  .add(sampleInfoPanel)
  .add(reminderPanel)
  .add(lcTypesPanel)
  .add(groundTruthPanel)

ui.root.widgets().reset([splitPanel]);

/***
 * Functions ----------------------------------------------------------------------------------
 */

function collectGroundTruthMaps(){
  var lcSelect = selectorLC.getValue()
  
  var buffToMap = ee.FeatureCollection([sampleSelect.buffer(sliderRadius.getValue()*1000)])
  mapGroundTruth.layers().set(1, ui.Map.Layer(buffToMap.style({fillColor:'#00000000', color:'#32c2c8'})))
  mapGroundTruth.centerObject(buffToMap)
  
  if (lcSelect === ''){
    examplesPanel.widgets().reset([])
    textLCdescription.setValue('')
    return
  }
  
  examplesPanel.widgets().reset([ui.Label('Fetching ground truth examples...', textStyleEmphasis)])
  
  
  textLCdescription.setValue(lcTypologyDict[lcSelect]);
  var lucasFilt = lucas.filter(ee.Filter.inList('lu1', lucasLookup[selectorLC.getValue()]))
  
  mapGroundTruth.layers().set(0, ui.Map.Layer(lucasFilt.style({pointSize:2, color:'#ed02f0'})))
  
  
  var lucasFiltBuff = lucasFilt.filterBounds(buffToMap)
  var numPts =lucasFiltBuff.size();
  
  numPts.evaluate(function(numPts){
    if (numPts === 0){
      examplesPanel.widgets().reset([ui.Label('No ground truth points detected. Please increase the search area radius', textStyleWarning)]);
    } else {
      examplesPanel.widgets().reset([]);
    }
    if (numPts > 12){
      numPts = 12
    }
    var numRows = 3
    var numCols = Math.ceil((numPts/numRows))
    
    for (var x = 1; x<(numCols+1); x++){
      var column = ui.Panel()
      
      for (var i = ((x-1)*numRows); i<((x*numRows)); i++){
        if (i > numPts-1){
          continue;
        }
        var toAdd = ee.Feature(lucasFiltBuff.toList(1000).get(i))
        var mapToAdd = ui.Map({style:{ height: deviceDict[DEVICE]['subMapHeight'], width: deviceDict[DEVICE]['subMapWidth']}});
        mapToAdd.centerObject(toAdd, 16)
        mapToAdd.setOptions('HYBRID')
        mapToAdd.setControlVisibility({
          mapTypeControl:false, 
          layerList: false, 
          fullscreenControl: false,
          scaleControl: false
        });
        mapToAdd.layers().set(0, ui.Map.Layer(ee.FeatureCollection([toAdd]).style({color:'#ed02f0'})))
        column.add(mapToAdd)
        
        var coords = toAdd.geometry().centroid().coordinates().getInfo()
          
        var googleURL = 'https://earth.google.com/web/@'+String(coords[1]) +','+String(coords[0]) +',65.02568564a,554.34383567d,35y,-0h,0t,0r/data=ChYqEAgBEgoyMDE4LTA1LTI4GAFCAggBOgMKATBCAggASg0I____________ARAA'
      
        var textURL = ui.Label('Inspect in Google Earth', textStyle, googleURL)
        
        mapToAdd.widgets().add(textURL)
          
        
      }
      
      examplesPanel.add(column)
      
      
    }
  })
  
  
}