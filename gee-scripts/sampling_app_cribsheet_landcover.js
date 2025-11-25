var MODE = 'dev';
//var MODE = 'live';

var refidUrl = 'a26-53806063921032_43-14870180527228'
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
var lucas = ee.FeatureCollection("JRC/LUCAS_HARMO/COPERNICUS_POLYGONS/V1/2018");
print(lucas.distinct(['letter_group']).reduceColumns(ee.Reducer.toList(), ['letter_group']))
var lucasPts = lucas.map(function(ft){return ft.centroid()});

var lucasLookup = {
  "A": 'Built',
  "B": 'Cropland',
  "C": 'Forest',
  "D": 'Shrubland',
  "E": 'Grassland',
  "F": 'Bare land',
  "G": 'Water',
  "H": 'Wetland'
}
var lucasLookupRev = {
  "Built": 'A',
  "Cropland": 'B',
  "Forest": 'C',
  "Shrubland": 'D',
  "Grassland": 'E',
  "Bare land": 'F',
  "Water": 'G',
  "Wetland": 'H'
}

// Minimum buffer size for ground truth collection
var minBuff = 10 // km

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
  'Built': 'Areas characterized by an artificial and often impervious cover of constructions and pavement. Includes roofed built-up areas and non-built-up area features such as parking lots and yards. Includes linear features such as roads, and other artificial areas such as bridges and viaducts, mobile homes, solar panels, power plants, electrical substations, pipelines, water sewage plants, open dump sites.',
  'Cropland': 'Areas where seasonal or perennial crops are planted and cultivated, including cereals, root crops, non-permanent industrial crops, dry pulses, vegetables, and flowers, fodder crops, fruit trees and other permanent crops. Includes temporary grasslands which are artificial pastures that may only be planted for one year. Includes permanent crops which are typically fruit trees, vineyards, olive groves. Excludes permanent pastures or grasslands which are not cleared or ploughed each year.',
  'Forest': 'Areas with a tree canopy cover of at least 10% including woody hedges and palm trees. Trees are generally considered those able to reach > 5m in height. Includes a range of coniferous and deciduous forest types. Excludes forest tree nurseries, young plantations or natural stands (< 10% canopy cover), dominated by shrubs or grass (considered shrubland and grassland, respectively).',
  'Shrubland': 'Areas dominated (at least 10% of the surface) by shrubs and low woody plants normally not able to reach >5m of height. Excludes berries, vineyards and orchards (considered cropland).',
  'Grassland': 'Land predominantly covered by communities of grassland, grass-like plants and forbs. This class includes permanent grassland and permanent pasture that is not part of a crop rotation (normally for 5 years or more). It may include sparsely occurring trees within a limit of a canopy below 10% and shrubs within a total limit of cover (including trees) of 20%. May include: spontaneously re-vegetated surfaces consisting of agricultural land which has not been cultivated this year or the years before; clear-cut forest areas; industrial “brownfields”; storage land. Excludes planted pastures where soil is ploughed and disturbed each year.',
  'Bare land': 'Areas with no dominant vegetation cover on at least 90% of the area OR areas covered by lichens/ moss. Areas covered by lichens/moss even if these are covering more than 10% of the ground. Includes other bare soil, which includes mining and tailing dumps, bare arable land (not cultivated for previous three years), temporarily unstocked areas within forests, burnt areas, secondary land cover for tracks and parking areas/yards.',
  'Wetland': 'Wetlands located inland and having fresh water. Also wetlands located on marine coasts or having salty or brackish water, as well as areas of a marine origin.',
  'Water': 'Inland or coastal areas without vegetation and covered by water and flooded surfaces, or likely to be so over a large part of the year. Areas covered by glaciers or permanent snow',
  '': '...'
}

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
var textTitle = ui.Label('Arena green to grey CRIB SHEET', titleStyle)

// Context texts
var textSampleId = ui.Label('Showing ground truths surrounging: ' + String(refidUrl), textStyleBold);

// Context info panel
var sampleInfoPanel = ui.Panel();
sampleInfoPanel
  .add(textSampleId)
  
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
  max:200, 
  value:10, 
  step:20, 
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
mapGroundTruth.layers().add(ui.Map.Layer(lucasPts.style({pointSize:2, color:'#ed02f0'})))
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
  var lucasPtsFilt = lucasPts.filter(ee.Filter.eq('letter_group', lucasLookupRev[selectorLC.getValue()]))
  var lucasFilt = lucas.filter(ee.Filter.eq('letter_group', lucasLookupRev[selectorLC.getValue()]))
  
  if (selectorLC.getValue() == 'Bare land'){
    lucasPtsFilt = lucasPtsFilt.filter(ee.Filter.neq('lc1', 'F40'))
    lucasFilt = lucasFilt.filter(ee.Filter.neq('lc1', 'F40'))
  }
  
  mapGroundTruth.layers().set(0, ui.Map.Layer(lucasPtsFilt.style({pointSize:2, color:'#ed02f0'})))
  
  
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
        mapToAdd.layers().set(0, ui.Map.Layer(ee.FeatureCollection([toAdd]).style({fillColor:'#00000000',width:1, color:'#ed02f0'})))
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