var MODE = 'dev';
//var MODE = 'live'; 

// A google sheet for storing data - must use same name as sheet
var GOOGLESHEET = 'name_of_google_sheet'

// Url for Google Cloud Function which handlse data storing and fetching
var CLOUDFUNCTIONURL = 'url_of_cloud_function'

// Url for the cribsheet app - land use
var CRIBSHEETAPPURL_LU = 'url_of_cribsheet_app'

// Url for the cribsheet app - land cover
var CRIBSHEETAPPURL_LC = 'url_of_cribsheet_app'

// AssetId for satellite imagery for visual interpretation
var SATELLITE_DATA_ASSETID = 'asset-directory-for-satellite-imagery'

// Empty object for storing completed sample ids
var DONEIDS;

var dummyData = [
  ['selectedName', 'sessionID', 'REFID'],
  ['zander_venter', 1737315465591, 'a0-04531303169832_38-7098534261595'],
  ['zander_venter', 1737315465591, 'a13-41513152710657_47-83830721083802'],
  ['zander_venter', 1737315465591, 'a16-93807322075551_45-40602113882165'],
  ['zander_venter', 1737315465591, 'a5-14691031269749_50-95077036791575'],
  ['zander_venter', 1737315465591, 'a29-224373994801_45-01713541270874'],
];

function fetchData(key, data, callback) {
 
  var payload = JSON.stringify(data);
  var request = new XMLHttpRequest();
  request.onload = function() {
    try {
      callback(JSON.parse(request.responseText));
    } catch (e) {
     callback({ success: false, error: "Python Error" });
    }
  };
  request.timeout = 20000;
  request.ontimeout = request.onerror = function() {
     
    callback({ success: false, error: "Connection Error" });
  };
  request.open("POST", CLOUDFUNCTIONURL + "name=" + key + "&fetch=Sheet1!A:C", true);
  request.responseType = "text";
  request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
  request.send(payload);
}

var sessionID = ee.Date(Date.now()).millis().getInfo()
print(sessionID)
var refidUrl = ui.url.get('refid');
if (MODE == 'dev'){
  refidUrl = null;
}

var INDEX = 0;
var REFID;
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
    splitPanelDirection: 'vertical',
  },
  is_mobile: {
    splitPanelDirection: 'vertical',
  }
}

/*
  // Setup global objects ///////////////////////////////////////////////////////////////////////////
*/ 

// Samples to process
var samples = ee.FeatureCollection('projects/nina/Arena/Sampling/pilot_sample');
var samples = ee.FeatureCollection('projects/nina/Arena/Sampling/samples_for_app_countries_v1')

var sampleSizeRaw = samples.size().getInfo();

var greyTrend = ee.Image('projects/nina/Arena/grey_trend_2018_2023_v3');
var lossTreshOptimal = 5;
var losses = greyTrend.gt(lossTreshOptimal).selfMask()

// Planetscope data
var planetScope = ee.ImageCollection(SATELLITE_DATA_ASSETID);

var startYear = 2018;
var endYear = 2023;

// Scene level cloud filter threshold
var cloudFilterThresh_sent = 30;

// Use 'cs' or 'cs_cdf', depending on your use case; see docs for guidance.
var QA_BAND = 'cs_cdf';
// The threshold for masking; values between 0.50 and 0.65 generally work well.
// Higher values will remove thin clouds, haze & cirrus shadows.
var CLEAR_THRESHOLD = 0.60;

// Sentinel-2 band names
var S2_BANDS = ['QA60', 'B1','B2','B3','B4', 'B5', 'B6', 'B7','B8','B11','B12']; // Sentinel bands
var S2_NAMES = ['QA60','cb', 'blue', 'green', 'red', 'R1', 'R2', 'R3','nir','swir1', 'swir2']; // Common names

// Text and panel styles
var titleStyle = {fontFamily:'cormorantgaramond-light', fontSize:'22px',color:'#000000',  backgroundColor: '#ffffff',  margin:'2px'};
var headingStyle = {fontFamily:'cormorantgaramond-light', fontSize:'20px', color:'#000000',backgroundColor: '#ffffff',  margin:'2px'};
var textStyle = {fontFamily:'monospace', fontSize:'11px', color:'#322220',backgroundColor: '#ffffff', padding:'2px', margin:'2px'};
var textStyleQuestion = {fontFamily:'monospace', fontSize:'11px', color:'#322220',backgroundColor: '#ffffff', padding:'8px 2px 2px 2px'};
var textStyleBold = {fontFamily:'monospace', fontSize:'11px', color:'#322220',backgroundColor: '#ffffff', fontWeight: 'bold', padding:'2px', margin:'2px'};
var textStyleEmphasis = {fontFamily:'monospace', fontSize:'13px',textDecoration: 'underline', color:'#322220',backgroundColor: '#ffffff'};
var textStyleWarning = {fontFamily:'monospace', fontSize:'12px', color:'#c87cff',backgroundColor: '#ffffff', fontWeight: 'bold',  padding:'2px', margin:'2px'};
var textWhite = {fontFamily:'monospace','background-color': '#00000000', color:'#ffffff', fontSize: '13px',padding:'2px', margin:'2px'}

/***
 * UI Widgets ----------------------------------------------------------------------------------
 */

// Intro panel
var introPanel = ui.Panel({
  style: {
    position:'top-center', 
    maxHeight: '500px',
    maxWidth: '600px',
    textAlign: 'center'
  }
});

// Tutorial text
var tutorialText = ui.Label('If this is your first time, please go through our onboarding tutorial here:',textStyle);
var tutorialURL = ui.Label('Arena collector tutorial', textStyle, 'https://docs.google.com/forms/d/e/1FAIpQLSd-H7O_X1-I23Yo8eVDX_wVRIW8hIsjUGceUIUt-jbk3le0BQ/viewform?usp=dialog')
var tutorialText2 = ui.Label('Remember to refer to the tutorial if needed:',textStyle);
var tutorialURL2 = ui.Label('Arena collector tutorial', textStyle, 'https://docs.google.com/forms/d/e/1FAIpQLSd-H7O_X1-I23Yo8eVDX_wVRIW8hIsjUGceUIUt-jbk3le0BQ/viewform?usp=dialog')

var tutorialPanel = ui.Panel({
  widgets: [tutorialText2,tutorialURL2],
  layout: ui.Panel.Layout.Flow('horizontal')
})

// Intro text
var introText = ui.Label('Please enter your user name so that we can fetch and store your data. For consistency, please use your name and surname separated by a hyphen, without uppercase: name_surname. (NB: please use the same name each time):', {textAlign:'left'})

// Name text
var nameBox = ui.Textbox('enter your name...')

// Start app button
var startButton = ui.Button('Start', startApp, true);
if (MODE == 'dev'){
  startButton.setDisabled(false)
}
// Main panel
var infoPanel = ui.Panel({
  style: {
    position:'top-center',
    maxHeight: '400px',
    //maxWidth: '400px',
    width:'40%'
  }
});
// Title text
var textTitle = ui.Label('Arena green to grey COLLECTOR', titleStyle)

// Title text
var textTitle2 = ui.Label('Welcome to Arena green to grey COLLECTOR', titleStyle)

// Update text
var updateText = ui.Label('UPDATE: the remaining samples were marked by humans as false-negatives. We want to double-check these to be make sure the humans were correct and AI was wrong.', textStyleWarning)

// Context texts
var textLatLon = ui.Label('', textStyleBold);
var textURL1 = ui.Label('Click here to see location in Google Earth', textStyle)
textURL1.style().set('shown', false);
var textURL2 = ui.Label('Click here to see location in ESRI Way Back', textStyle)
textURL2.style().set('shown', false);
var textURL3 = ui.Label('Click here to see location in Planet Labs basemaps', textStyle)
textURL3.style().set('shown', false);

// Context info panel
var sampleInfoPanel = ui.Panel();
sampleInfoPanel
  .add(textLatLon)
  .add(textURL1)
  .add(textURL2)
  //.add(textURL3)

// Question 1 text
var q1Text = ui.Label('1. Was there built-up expansion in the red square between 2018 and 2023? ', textStyleQuestion)
var q1Selector = ui.Select({
  items: ['yes', 'no', 'uncertain', ''], 
  placeholder: '',
  onChange: handleQ1
})
var q1TextPanel = ui.Panel({
  widgets: [q1Text, q1Selector],
  layout: ui.Panel.Layout.Flow('horizontal') 
})

// Question 2
var q2Text = ui.Label('2. What was the land cover in 2018? ', textStyleQuestion)
var q2Selector = ui.Select({
  items: ['built', 'cropland', 'bareland', 'grassland/wetland', 'shrubland','forest','water','uncertain',''], 
  placeholder: ''
})
var cribsheetLCText = ui.Label('See cribsheet for examples',textStyleQuestion)
var q2TextPanel = ui.Panel({
  widgets: [q2Text, q2Selector, cribsheetLCText],
  layout: ui.Panel.Layout.Flow('horizontal')
})

// Question 3
var q3Text = ui.Label('3. What land use was associated with the built-up expansion? (you can add two labels if neccessary) ', textStyleQuestion)
var q3Text_2 = ui.Label('-- 3a. Primary function ', textStyleQuestion)
var q3Text_3 = ui.Label('-- 3b. Secondary land use (optional)', textStyleQuestion)
var cribsheetLUText = ui.Label('See cribsheet for examples',textStyleQuestion)

var landuseOptions = [
  "Agriculture",
  "Forestry",
  "Mining and Quarrying",
  "Energy Production",
  "Industry and Manufacturing",
  "Transport, Communication Networks, and Logistics",
  "Water and Waste Treatment",
  "Commerce and Services",
  "Community Services",
  "Recreation, Leisure, and Sports",
  "Residential",
  "Uncertain",
  ""
]

var q3Selector = ui.Select({
  items: landuseOptions, 
  placeholder: ''
})
var q3Selector_2 = ui.Select({
  items: landuseOptions, 
  placeholder: ''
})
var q3TextPanel = ui.Panel({
  widgets: [
    ui.Panel({
      widgets: [q3Text,cribsheetLUText],
      layout: ui.Panel.Layout.Flow('horizontal')
    }),
    ui.Panel({
      widgets: [q3Text_2, q3Selector, q3Text_3, q3Selector_2],
      layout: ui.Panel.Layout.Flow('horizontal'),
      style: {padding:  '4px 4px 4px 15px' }
    })
    ],
  layout: ui.Panel.Layout.Flow('vertical')
})


// Question 4
var q4Text = ui.Label('4. How confident are you for this location? ', textStyleQuestion)
var q4Selector = ui.Select({
  items: ['very uncertain', 'uncertain', 'moderately certain', 'very certain', ''], 
  placeholder: ''
})
var q4TextPanel = ui.Panel({
  widgets: [q4Text, q4Selector],
  layout: ui.Panel.Layout.Flow('horizontal')
})

// Question 5
var q5Text = ui.Label('Notes or comments: ', textStyleQuestion)
var q5Textbox = ui.Textbox('');
var q5TextPanel = ui.Panel({
  widgets: [q5Text, q5Textbox],
  layout: ui.Panel.Layout.Flow('horizontal')
})

// Question 6
var q6Text = ui.Label('Star this location for later? ', textStyleQuestion)
var q6Checkbox = ui.Checkbox('',false, handleStar, false, {padding:'8px 2px 2px 2px' });
var q6TextPanel = ui.Panel({
  widgets: [q6Text, q6Checkbox],
  layout: ui.Panel.Layout.Flow('horizontal')
})

function handleStar(val){
  if (val){
   q6Checkbox.setLabel('⭐')  
  } else {
   q6Checkbox.setLabel('') 
  }
  
}

// Warning message questions incomplete
var warningQeustionText = ui.Label('Please answer all questions before submitting', textStyleWarning)


//  Questions panel
var questionsPanel = ui.Panel();
questionsPanel
  .add(q1TextPanel)
  .add(q2TextPanel)
  .add(q3TextPanel)
  .add(q4TextPanel)
  .add(q5TextPanel)
  .add(q6TextPanel)

// Messages panel
var messagesPanel = ui.Panel();

// Buttons panel 
var backButton = ui.Button('Go Back', goBack);
var submitButton = ui.Button('Submit', handleSubmitButton);

var buttonPanel = ui.Panel({
  widgets: [backButton, submitButton],
  layout: ui.Panel.Layout.Flow('horizontal'),
  style: {shown:true}
})

// Timelapse panels
var panelTimeLapse = ui.Panel({
  style:{ minWidth: '100px', minHeight: '45px', position: 'bottom-right', 'background-color': 'ffffff80', shown: false }
});


/***
 * UI deploy ----------------------------------------------------------------------------------
 */

introPanel
  .add(textTitle2)
  .add(updateText)
  .add(tutorialText)
  .add(tutorialURL)
  .add(introText)
  .add(nameBox)
  .add(startButton);

// Create a split panel with the two panels
var splitPanel = ui.SplitPanel({
  firstPanel: infoPanel,
  secondPanel: panelTimeLapse,
  orientation: deviceDict[DEVICE]['splitPanelDirection'],
  wipe: false,
  //style:{maxWidth: '500px'}
});

infoPanel
  .add(textTitle)
  .add(tutorialPanel)
  .add(sampleInfoPanel)
  .add(questionsPanel)
  .add(messagesPanel)
  .add(buttonPanel);

ui.root.widgets().reset([introPanel]);


if (MODE != 'dev'){
  fetchData(GOOGLESHEET, null, handleData)
} else {
  handleData({success: true, data: dummyData})
}

/*
  // UI functions ///////////////////////////////////////////////////////////////////////////
*/
function payloadToFeatureCollection(array){
  // Extract the header (first row) and data (remaining rows)
  var header = array[0]; // ['selectedName', 'sessionID', 'REFID']
  var data = array.slice(1); // Remaining rows
  
  // Convert the data into features using `map`
  var features = data.map(function(row) {
    // Use `reduce` to pair each header column with its corresponding row value
    var properties = header.reduce(function(acc, key, index) {
      acc[key] = row[index]; // Create key-value pairs
      return acc;
    }, {}); // Start with an empty object
    return ee.Feature(null, properties); // Create a feature with these properties
  });
  // Create a FeatureCollection
  var featureCollection = ee.FeatureCollection(features);
  return featureCollection
}

var chart;
var sampleList;
var samplesFiltered;
function handleData(payload){
  if (payload.success){
    print(payload.data)
    //print(payloadToFeatureCollection(payload.data))
    
    DONEIDS = payload.data.slice(1) // Remove the header row
      .map(function(row) {
        return row[2]; // Return the REFID (3rd column) from each row
      });
    //introPanel.add(ui.Label(DONEIDS))
    
    chart = ui.Chart.feature.histogram(payloadToFeatureCollection(payload.data), 'selectedName').setOptions({
      title: 'Count of samples per contributor so far:',
      hAxis: {
        title: 'Contributor'
      },
      vAxis: {
        title: 'Sample units processed'
      },
      legend: { position: 'none' }
    });
    
    // Get the sample with REFID if inside the URL
    if (refidUrl){
      var urlFeature = samples.filter(ee.Filter.eq('PLOTID', refidUrl)).first()
    }
    
    //infoPanel.add(ui.Label(DONEIDS))
    print(samples.size(), 'samples before filtering')
    var doneFeats = DONEIDS.map(function(i){ return ee.Feature(null, {PLOTID: i})});
    doneFeats = ee.FeatureCollection(doneFeats);
    var filter = ee.Filter.equals({
      leftField: 'PLOTID',
      rightField: 'PLOTID'
    });
    samplesFiltered = ee.Join.inverted().apply(samples, doneFeats, filter);
    print(samplesFiltered.size(),  'samples after filtering');
    
    //Export.table.toAsset({
    //  collection: samplesFiltered, 
    //  description: 'samples_for_app_combined_v1_filtered', 
    //  assetId:'Arena/Sampling/samples_for_app_combined_v1_filtered',
    //  priority:9999
    //})
    
    // add random sorting for the session
    samplesFiltered = samplesFiltered.randomColumn('rndSession', sessionID).sort('rndSession');
    
    var sampleSizeFiltered = samplesFiltered.size().getInfo();
    
    var totalPts = Math.round(sampleSizeRaw );
    var remainingPts = Math.round(sampleSizeFiltered);
    
    
    if (sampleSizeFiltered === 0){
      introPanel.add(ui.Label('All the samples are completed! Great work. Sit down and relax ;)', textStyleWarning))
      startButton.setDisabled(true)
      introPanel.add(chart)
      return
    }
    
    introPanel.add(ui.Label('Remaining verifications: ' + String(remainingPts) +' out of ' + String(totalPts) ))
    introPanel.add(chart)
    
    // Add in the url feature at the beginning in case this was registered
    if (refidUrl){
      samplesFiltered = ee.FeatureCollection([urlFeature]).merge(samplesFiltered);
    } 
    //samplesFiltered = samplesFiltered.filter(ee.Filter.eq('PLOTID', 'a17-14426806353541_48-86848210630902'))
    sampleList = samplesFiltered.toList(10000);
    
    startButton.setDisabled(false)
    
    } else {
    introPanel.add(ui.Label('failed to collect data - please report error to zander.venter@nina.no'))
  }
}


var selectedName;
var selected;
function startApp(){
  
  //print(sampleList.slice(0,6))
  selected = ee.Feature(sampleList.get(INDEX))
  //print(selected, 'selected')
  
  selectedName = nameBox.getValue();
  
  ui.root.widgets().reset([splitPanel]);
  
  handleNext()
}

function handleQ1(answer){
  if (answer == 'no'){
    //q2TextPanel.style().set('shown', false)
    q3TextPanel.style().set('shown', false)
    //q4TextPanel.style().set('shown', false)
  } else {
    q2TextPanel.style().set('shown', true)
    q3TextPanel.style().set('shown', true)
    q4TextPanel.style().set('shown', true)
  }
}

var selectedPlanetScopeImages;
var selectedSentinelImages;
function handleNext(){
  
  REFID = selected.get('PLOTID').getInfo()
  ui.url.set('refid', REFID)
  
  q2TextPanel.style().set('shown', true)
  q3TextPanel.style().set('shown', true)
  q4TextPanel.style().set('shown', true)
  q1Selector.setValue('')
  q2Selector.setValue('')
  q3Selector.setValue('')
  q3Selector_2.setValue('')
  q4Selector.setValue('')
  q5Textbox.setValue('')
  q6Checkbox.setValue(false, true);
  
  var cribsheetLCurl = CRIBSHEETAPPURL_LC + '#refid=' + String(REFID)
  cribsheetLCText.setUrl(cribsheetLCurl)
  
  var cribsheetLUurl =  CRIBSHEETAPPURL_LU + '#refid=' + String(REFID)
  cribsheetLUText.setUrl(cribsheetLUurl)
  
  sampleInfoPanel.widgets().set(3,ui.Label('Index: ' + String(INDEX) + ' & PLOTID: ' + String(REFID) , textStyleBold))
    
  selected.geometry().centroid().coordinates().evaluate(function(coords){
    
    selectedSentinelImages = ee.ImageCollection([
      getS2(selected.geometry(), 2018, 2018, 1, 12, true, false), 
      getS2(selected.geometry(), 2023, 2023, 1, 12, true, false)
      ])
      
    
    selectedPlanetScopeImages = planetScope.filter(ee.Filter.eq('boxid', REFID));
    
    //showReferenceImages(coords, selectedImages, startYear, endYear)
    if (selectedPlanetScopeImages.size().getInfo()){
      showReferenceImagesSplitPanel(coords, selectedPlanetScopeImages)
    } else {
      print('doing sentinel')
      showReferenceImagesSplitPanel(coords, selectedSentinelImages)
    }
    
    
    var googleURL = 'https://earth.google.com/web/@'+String(coords[1]) +','+String(coords[0]) +',65.02568564a,554.34383567d,35y,-0h,0t,0r/data=ChYqEAgBEgoyMDI0LTA2LTA5GAFCAggBOgMKATBCAggASg0I____________ARAA'
    var livingatlasURL = 'https://livingatlas.arcgis.com/wayback/#active=25982&mapCenter='+String(coords[0]) +'%2C' +String(coords[1]) +'%2C17'
    var planetURL = 'https://www.planet.com/basemaps/#/mode/compare/mosaic/global_quarterly_2018q3_mosaic/comparison/global_quarterly_2023q3_mosaic/center/'+String(coords[0]) +','+String(coords[1]) +'/zoom/17'
    
    textLatLon.setValue('Location coordinates: ' + String(coords[1]) + ', ' + String(coords[0]))
    textURL1.style().set('shown', true);
    textURL1.setUrl(googleURL);
    textURL2.style().set('shown', true);
    textURL2.setUrl(livingatlasURL);
    textURL3.style().set('shown', true);
    textURL3.setUrl(planetURL);
      
    })

  
}


function goBack(){
  INDEX = INDEX - 1
  
  selected = ee.Feature(sampleList.get(INDEX))
  print(selected, 'goBack selected')
  
  handleNext();
  
}

var timeCheckpoint = ee.Date(Date.now());
var timeSpent;
function handleSubmitButton(){
  
  timeSpent = ee.Date(Date.now()).difference(timeCheckpoint, 'second').getInfo();
  timeCheckpoint = ee.Date(Date.now());
  
  var cond1 = q2Selector.getValue() === '' | q3Selector.getValue() === '' | q4Selector.getValue() === '';
  var cond2 = q2Selector.getValue() === '' | q4Selector.getValue() === '';
  
  //if ( ((q1Selector.getValue() == 'yes' | q1Selector.getValue() == 'uncertain') && cond1) | (q1Selector.getValue() == 'no' && cond2)  ){
  //  print('not')
  //  messagesPanel.widgets().reset([warningQeustionText]);
  //  return
  //} else {
  //  messagesPanel.clear()
  //}
  
  
  var data = [[
    selectedName, sessionID, REFID, INDEX,
    q1Selector.getValue(), q2Selector.getValue(), q3Selector.getValue(), q3Selector_2.getValue(), q4Selector.getValue() ,
    timeSpent, q5Textbox.getValue(), q6Checkbox.getValue()
    ]];
  print(data, 'data to sheets')
  
  if (MODE != 'dev'){
    storeData(GOOGLESHEET, data, function(res) { return });
  }
  
  INDEX = INDEX + 1;
  
  //print(sampleList.slice(0,6))
  selected = ee.Feature(sampleList.get(INDEX))
  //print(selected, 'selected')
  
  handleNext();
}

var insetShow = true;
function handleInsetMap(){
  
  if(insetShow){
    insetShow = false;
    //panelTimeLapse.style().set('shown', false);
    //map2.remove(insetMapButton);
    panelTimeLapse.widgets().remove(map2)
    panelTimeLapse.widgets().add(insetMapButton_2)
  } else {
    insetShow = true;
    //panelTimeLapse.style().set('shown', true);
    panelTimeLapse.widgets().remove(insetMapButton_2)
    //map2.add(insetMapButton);
    panelTimeLapse.widgets().add(map2)
  }
  
}

function getBBox(geometry, proj) {
  // Transform the geometry to the target projection
  var transformed = geometry.transform(proj, 1);

  // Get the coordinates of the geometry
  var coords = ee.List(transformed.coordinates());

  // Align the coordinates with the pixel grid
  var c1 = coords.map(function(p) { return ee.Number(p).floor(); });
  var c2 = c1.map(function(p) { return ee.Number(p).add(1); });

  // Create the bounding box as a rectangle
  var bbox = ee.Geometry.Rectangle(
    [ee.List(c1).get(0), ee.List(c1).get(1), ee.List(c2).get(0), ee.List(c2).get(1)],
    proj,
    false
  );

  return bbox;
}

/*
  // Animation functions ///////////////////////////////////////////////////////////////////////////
*/

var map2;
var insetMapButton;
var insetMapButton_2;
var timelapeseInstrucPanel;
var loadingInstruc;
var drawingTools;

function showReferenceImages(pt, images, startYear, endYear) {
  
  var center = ee.Geometry.Point(pt)
  
  var mapZoom = 17
  
  var style = {
    'Deep': [{
        featureType: 'all',
        stylers: [{ color: '#ffffff'}]
    }]
  };
  
  // animate images    
  map2 = ui.Map({ lat: pt[1], lon: pt[0] , zoom: mapZoom }, false, { height: '350px', width: '420px'})
  //map2.setOptions('Deep', style)
  map2.setOptions('SATELLITE')
  map2.setControlVisibility({
    mapTypeControl:false, 
    layerList: false, 
    fullscreenControl: false
  });
  //map2.setOptions('Deep', style)
  map2.centerObject(center, mapZoom);
  
  drawingTools = ui.Map.DrawingTools({shown:false});
  drawingTools.setDrawModes(['polygon']);
  //drawingTools.onLayerAdd(handleLayerAdd);
  
  map2.add(drawingTools);
  
  var proj = ee.Image('projects/nina/Arena/grey_trend_2018_2023_v3').projection()
  
  var quadrat = getBBox(center, proj)
  quadrat = quadrat.transform(ee.Projection('EPSG:4326'),1);
  var cList = quadrat.coordinates().get(0);
  var selectedLine = ee.Geometry.LinearRing(cList);
  selectedLine.evaluate(function(geo){
    drawingTools.layers().reset([ui.Map.GeometryLayer([center], 'pt', '#ff0000', true, false)]);
  });
  
  loadingInstruc = ui.Label('Loading...please wait', textWhite)

  timelapeseInstrucPanel = ui.Panel({
    style: {shown:false, 
    'background-color': '#00000080', position: 'top-center', 
    margin:'0px', padding:'0px', minWidth:'230px'
    }
  })
  
  var vis = {min:0, max:2000, bands: ['red', 'green', 'blue']}
  //var vis = {min:0, max:1, bands:['ndvi'], palette: endviPalette}
  var a = animate(images, { 
    vis: vis,
    map: map2, 
    compact: true, 
    hidePlay: true, 
    maxFrames: 60, 
    width: '300px',
    label: 'label',
    position: 'bottom-left'
    // preloadCount: 1
  })

  a.then(function() {
    // map.addLayer(ee.FeatureCollection([bounds]).style({ width: 2, color: '00ffff', fillColor: '00ffff11' }), {}, 'bounds')

    // var edges = ee.Algorithms.CannyEdgeDetector(image.select('Alert').unmask(0, false).resample(resamplingMode), 0.1)
    // map.addLayer(edges.selfMask(), { palette: ['fd8d3c'], min: 0, max: 1 }, 'alert', true, 0.5)

    a.panel.style().set({ 'background-color': '#00000080'})
    a.panel.widgets().get(0).style().set({ 'background-color': '#00000000' , padding:'0px',  fontSize: 0 }) // slider
    a.panel.widgets().get(1).style().set({ 'background-color': '#00000000' })
    a.panel.widgets().get(2).style().set({ 'background-color': '#00000000' })
    a.panel.widgets().get(3).style().set({ 'background-color': '#00000000', 'color': '#ffffff' })
    
    // change properties of the main panel of animation controls
    // print(a.panel)
    // a.panel.widgets().reset([])
  })
  
  insetShow = true
  panelTimeLapse.widgets().reset([map2])
  panelTimeLapse.style().set({ shown: true })
  //insetMapButton.setLabel('Hide');
  //handleInsetMap()
  
  // add close button
  insetMapButton = ui.Button('Hide', handleInsetMap)
  insetMapButton.style().set({ margin: '0px', padding: '0px', textAlign: 'left', position: 'bottom-right' })
  
  insetMapButton_2 = ui.Button('See timelapse', handleInsetMap)
  insetMapButton_2.style().set({ margin: '0px', padding: '0px', textAlign: 'left', position: 'bottom-right' })
  
  map2.widgets().add(insetMapButton)
  map2.widgets().add(timelapeseInstrucPanel)

}




var mapSplit1;
var mapSplit2;
var drawingToolsSplit1;
var drawingToolsSplit2;
function showReferenceImagesSplitPanel(pt, images) {
  
  var center = ee.Geometry.Point(pt)
  
  var mapZoom = 16
  
  var mapParams = { lat: pt[1], lon: pt[0] , zoom: mapZoom }
  mapSplit1 = ui.Map(mapParams, false, { height: '350px', width: '420px'})
  mapSplit1.setOptions('ROADMAP')
  mapSplit1.setControlVisibility({
    mapTypeControl:false, 
    layerList: false, 
    fullscreenControl: false
  });
  mapSplit1.centerObject(center, mapZoom);
  
  mapSplit2 = ui.Map(mapParams, false, { height: '350px', width: '420px'});
  mapSplit2.setOptions('HYBRID')
  mapSplit2.setControlVisibility({
    mapTypeControl:true, 
    layerList: true, 
    fullscreenControl: false
  });
  mapSplit2.centerObject(center, mapZoom);
  
  var image1 = images.filter(ee.Filter.eq('year', 2018))
  var image2 = images.filter(ee.Filter.eq('year', 2023))
  
  mapSplit1.layers().reset([ui.Map.Layer(image1, {}, 'PlanetScope 2018')])
  //mapSplit2.layers().reset([
  //  ui.Map.Layer(image2, {}, 'PlanetScope 2023'), 
  //  ui.Map.Layer(losses, {palette:['yellow']}), 
  //  ui.Map.Layer(greyTrend, {min:0, max:10, palette:['black', 'yellow']})
  //  ])
  mapSplit2.layers().reset([ui.Map.Layer(image2, {}, 'PlanetScope 2023')])
  
  var mapLinker = new ui.Map.Linker([mapSplit1, mapSplit2]);
  
  var splitPanelMaps = ui.SplitPanel({
    firstPanel: mapSplit1,
    secondPanel:mapSplit2,
    orientation: 'horizontal',
    wipe: true,
    //style:{maxWidth: '500px'}
  });
  //panelTimeLapse.widgets().reset([splitPanelMaps])

  
  drawingToolsSplit1 = ui.Map.DrawingTools({shown:false});
  drawingToolsSplit1.setDrawModes(['polygon']);
  
  drawingToolsSplit2 = ui.Map.DrawingTools({shown:false});
  drawingToolsSplit2.setDrawModes(['polygon']);
  
  mapSplit1.add(drawingToolsSplit1);
  mapSplit2.add(drawingToolsSplit2);
  
  var proj = ee.Image('projects/nina/Arena/grey_trend_2018_2023_v3').projection()
  //var proj = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED').filterBounds(center).first().projection();
  
  var quadrat = getBBox(center, proj)
  quadrat = quadrat.transform(ee.Projection('EPSG:4326'),1);
  var cList = quadrat.coordinates().get(0);
  var selectedLine = ee.Geometry.LinearRing(cList);
  
  selectedLine.evaluate(function(geo){
    drawingToolsSplit1.layers().reset([ui.Map.GeometryLayer([geo], 'pt', '#ff0000', true, false)]);
    drawingToolsSplit2.layers().reset([ui.Map.GeometryLayer([geo], 'pt', '#ff0000', true, false)]);
  });
  
  panelTimeLapse.widgets().reset([splitPanelMaps])
  panelTimeLapse.style().set({ shown: true })
  //insetMapButton.setLabel('Hide');
  //handleInsetMap()
  
  // add close button
  var leftDate = ui.Label('2018        ')
  leftDate.style().set({ margin: '0px', padding: '2px 50px 2px 2px', textAlign: 'left', position: 'top-center', color:'#d13328' })
  var rightDate = ui.Label('        2023')
  rightDate.style().set({  margin: '0px', padding:  '2px 2px 2px 50px',textAlign: 'left', position: 'top-center', color:'#d13328' })
  
  mapSplit1.widgets().add(leftDate)
  mapSplit2.widgets().add(rightDate)


}




var timeout = null
var play = false

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function addAnimationControls(layers, opacity, position, timeStep, width, labelProperty, compact, onChange, hidePlay, map, preloadLast) {
  
  var currentIndex = 0
  
  if(preloadLast) {
    currentIndex = map.layers().length()-1
  }
  
  layers.map(function(l) { 
    l.setOpacity(opacity) 
  })
  
  var onSlide = function(index) {
    onChange(index)

    layers[currentIndex].setOpacity(0)
    //layers.map(function(a, i) { if (i != index) { a.setOpacity(0); } });
    
    var l = layers[index]
    
    l.setOpacity(opacity)
    
    currentIndex = index

    // update visibility if needed
    var shown = l.getShown()
    if(!shown) {
      l.setShown(true) 
    }
    
    label.setValue(layers[index].getName())
  };

  var label = ui.Label('');
  
  function onHideLayers() {
    layers.map(function(l) {
      l.setShown(false)
    })
  }

  function nextFrame() { 
    var index = currentIndex + 1
    if(index >= layers.length) {
      index = 0
    }

    slider.setValue(index)
    
    if(play) {
      ui.util.setTimeout(nextFrame, timeStep)
    }
  }

  function onPlayPause() {
    if(!play && !timeout) {
      timeout = ui.util.setTimeout(nextFrame, timeStep)
      play = true
      buttonPlayPause.setLabel(textPause)
    } else {
      ui.util.clearTimeout(timeout)
      timeout = null
      play = false
      buttonPlayPause.setLabel(textPlay)
    }
  }
  
  var textPlay = '▶️'
  var textBack = '◀️'
  var textPause = '⏸'
  
  var buttonPlayPause = ui.Button(textPlay, onPlayPause, false, {padding: '10px'})
  
  if(hidePlay) {
    buttonPlayPause.style().set({ shown: false })
  }
  
  var buttonHideLayers = ui.Button('Hide', onHideLayers)

  var slider = ui.Slider({
    value: currentIndex,
    min: 0,
    max: layers.length - 1,
    step: 1,
    style: {stretch: 'horizontal', fontSize: '9px'}
  });

  slider.onSlide(onSlide)
  
  function onNext(){
    slider.setValue(slider.getValue() + 1, true)
  }
  var buttonNext = ui.Panel([ui.Checkbox(textPlay, true, onNext, false, {padding:'0px', margin:'4px 4px 0px -15px'})])
  
  function onBack(){
    slider.setValue(slider.getValue() - 1, true)
  }
  var buttonBack = ui.Panel([ui.Checkbox(textBack, true, onBack, false, {padding:'0px', margin: '4px 4px 0px -15px'})])
  
  var sliderOpacity = ui.Slider({
    min:0, max: 1, step: 0.1
  })
  
  sliderOpacity.onSlide(function(o) {
    layers[currentIndex].setOpacity(o)
    opacity = o
  })
  
  sliderOpacity.setValue(opacity)

  var widgets = [slider, label, buttonPlayPause, buttonHideLayers, sliderOpacity]

  if(compact) {
    widgets = [slider, buttonBack, buttonNext, label]
  }
  
  // Create a panel that contains both the slider and the label.
  var panel = ui.Panel({
    widgets: widgets,
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {
      position: position,
      padding: '0px 0px 8px 0px',
      width: width
    }
  });
  
  map.add(panel)

  layers[currentIndex].setOpacity(1)
  
  // loop
  function delay(millis, callback) {
    var before = Date.now();
    
    function loop() {
      ee.Number(Date.now()).evaluate(function(now) { 
        if(now < before + millis) {
          loop()
        } else {
          callback()
        }
      })
    }
    
    loop()
  }
  
  function setTimeout(interval, action) {
    delay(interval, function() {
      action()
      
      setTimeout(interval, action)
    }) 
  }
  
  // update layer names (async)
  if(labelProperty) {
    layers.map(function(layer) {
      var image = ee.Image(layer.getEeObject())
      
      var labelValue = ''
      
      if(labelProperty == '{{date}}') {
        labelValue = image.date().format('YYYY-MM-dd')
      } else {
        labelValue = image.get(labelProperty)
      }
      
      labelValue.evaluate(function(s) {
        layer.setName(s)
        
        slider.setValue(slider.getValue())
      
        if(layer.getShown()) { 
          label.setValue(s)
        }
      })
    })
  }

  return panel
}

function animate(images, options) {
  var maxFrames = (options && options.maxFrames) || 30
  var width = (options && options.width) || '300px'
  var labelProperty = (options && options.label) || null
  var compact = (options && options.compact) || false
  var vis = (options && options.vis) || {}
  var opacity = (options && options.opacity) || 1.0
  var position = (options && options.position) || 'top-center'
  var prefix = (options && options.prefix) || ''
  var timeStep = (options && options.timeStep) || 100
  var onChange = (options && options.onChange) || function(i) {}
  var preloadCount = (options && options.preloadCount) || 999999
  var map = (options && options.map) || Map

  var preloadLast = false
  if(options && options.preloadLast != 'undefined') {
    preloadLast = options.preloadLast
  }

  var hidePlay = true
  if(options && options.hidePlay != 'undefined') {
    hidePlay = options.hidePlay
  }

  var preload = true
  
  if(options && options.preload != 'undefined') {
    preload = options.preload
  }
  
  images = ee.ImageCollection(images).toList(maxFrames, 0)

  maxFrames = images.size().min(maxFrames)
  
  // add loading panel
  var label = ui.Label('Loading images...please wait....');
  var panel = ui.Panel({
    widgets: [label],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {
      position: position,
      padding: '7px',
      width: width
    }
  });
  map.widgets().add(panel)
  timelapeseInstrucPanel.style().set('shown', true);
  timelapeseInstrucPanel.widgets().reset([loadingInstruc])

  // chaining
  var s = {}

  s.panel = panel

  s.then = function(callback) { 
    s.callback = callback

    return s
  }
  
  var lodingPanel = panel
  
  ee.List.sequence(0, maxFrames.subtract(1)).evaluate(function(indices) {
    var layers = []

    indices.map(function(i) {
      var image = ee.Image(images.get(i))
      var name = prefix + ' ' + pad(i, 2)
      
      if(options && options.clip) {
        image = image.clip(options.clip)
      }

      var visible = preload

      if(preload == false || i >= preloadCount) {
        visible = false
      }
      
      if(preloadLast) {
        visible = false
      }

      var layer = ui.Map.Layer(image, vis, name, visible)
      map.layers().add(layer)
      layers.push(layer)
    })
    
    // show layers from the end
    if(preloadLast) {
      map.layers().get(0).setShown(false)
      
      for(var i=0; i<preloadCount; i++) {
        var index = map.layers().length()-1-i
        
        map.layers().get(index).setShown(true)
      }
    }
    
    // remove loading panel
    map.widgets().remove(lodingPanel)
    
    // Additional loading panel
    function arrSum(arr){
      var sum = 0;
      for (var i = 0; i < arr.length; i++ ) {
        sum += arr[i];
      }
      return sum
    }
    
    map.onTileLoaded(function(loaded){
      
      //print(loaded)
      
      if (arrSum(loaded) != 0){
        
        return
      
      } else {
        //print('finished loading')
        timelapeseInstrucPanel.style().set('shown', false)
        timelapeseInstrucPanel.widgets().reset([])
        layers.forEach(function(a, i) { if (i > 0) { a.setOpacity(0); } });
        
      }
    })

    var panel = addAnimationControls(layers, opacity, position, timeStep, width, labelProperty, compact, onChange, hidePlay, map, preloadLast)

    // replace panel
    s.panel = panel
    s.clear = function() {
      map.widgets().remove(panel)
      
      layers.forEach(function(layer) {
        map.layers().remove(layer)
      })
    }
    
    s.hideLayers = function() {
      layers.forEach(function(layer) {
        if(!layer.getOpacity()) { // hide non-active layers
          layer.setShown(false)
        }
      })
    }
    

    if(s.callback) {
      s.callback()
    }
  })

  return s



}




/*
  // Remote sensing functions ///////////////////////////////////////////////////////////////////////////
*/

function getS2(aoi, startYear, endYear, startMonth, endMonth, filterClouds, maskClouds) { 
  var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');
  
  var s2 = ee.ImageCollection("COPERNICUS/" + 'S2_HARMONIZED')
    .filterBounds(aoi)
    .filter(ee.Filter.calendarRange(startYear, endYear, 'year'))
    .filter(ee.Filter.calendarRange(startMonth,endMonth, 'month'));
  if (filterClouds){
      s2 =  s2.filterMetadata('CLOUDY_PIXEL_PERCENTAGE', 'less_than', cloudFilterThresh_sent);
  } 
  if (maskClouds){
    s2 = s2.linkCollection(csPlus, [QA_BAND])
      .map(function(img) {
        return img.updateMask(img.select(QA_BAND).gte(CLEAR_THRESHOLD));
      })
  } 
  s2 = s2.select(S2_BANDS, S2_NAMES);
    
  s2 = s2.select(['red', 'green', 'blue', 'nir']).median();
  
  return s2.visualize({min:0, max:2000, bands: ['red', 'green', 'blue']}).set('year', startYear)
}


//calculate the NDVI
function add_NDVI(image) { 
  return image.addBands(image.normalizedDifference(['nir', 'red']).rename('ndvi'));
}

// Function to aggregate image collection to annual/monthly/weekly/daily intervals
function temporalAverage(collection, unit, reducer) {
  var startDate = ee.Date(ee.Image(collection.sort('system:time_start').first().get('system:time_start')));
  startDate = startDate.advance(ee.Number(0).subtract(startDate.getRelative('month',unit)),'month')
    .update(null,null,1,0,0,0);
  
  var endDate = ee.Date(ee.Image(collection.sort('system:time_start',false).first()).get('system:time_start'));
  endDate = endDate.advance(ee.Number(0).subtract(endDate.getRelative('month',unit)),'month')
    .advance(1,unit).advance(-1,'month')
    .update(null,null,null,23,59,59);

  var dateRanges = ee.List.sequence(0, endDate.difference(startDate,unit).round().subtract(1))

  function makeTimeslice(num) {
    var start = startDate.advance(num, unit);
    var startDateNum = start.millis();
    var end = start.advance(1, unit).advance(-1, 'second');
    // Filter to the date range
    var filtered = collection.filterDate(start, end);
    // Get the mean
    var unitMeans = filtered.reduce(reducer).rename(ee.Image(collection.first().bandNames()))
      .set('system:time_start',startDateNum, 'date',start);
    return unitMeans;
  }
  // Aggregate to each timeslice
  var new_collection = ee.ImageCollection(dateRanges.map(makeTimeslice));

  return new_collection;
};

/***
 * Data export function ----------------------------------------------------------------------------------
 */

function storeData(key, data, callback) {
  
  var payload = JSON.stringify(data);
  
  var request = new XMLHttpRequest();
  request.onload = function() {
  
    callback(JSON.parse(request.responseText));
  };
  request.timeout = 20000;
  request.ontimeout = request.onerror = function() {
      
    callback(JSON.parse({ success: false, error: "Connection Error" }));
  };
  request.open("POST", CLOUDFUNCTIONURL + "name=" + key, true);
  request.responseType = "text";
  request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
  request.send(payload);
}
