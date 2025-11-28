/**
 * This script extracts strata areas and mapped labels for a sensitivity analysis
 * aimed at testing the effect of (1) the buffer stratum definition and (2) the trend threshold selection
 * 
 * 1. Import samples and DW built trend layer
 * 2. iterate over trend trehsolds and extract map labels and map areas
 * 3. iterate over buffer distances and extract map labels and map areas
 * 
 * Author: Zander Venter
 */
 
/***
 * 1. Import samples and DW built trend layer ------------------------------------+-------------------------------
 */

// Export projection
var proj = ee.Projection('EPSG:3035').atScale(10)

// Sample locations
var samples = ee.FeatureCollection('projects/nina/Arena/Sampling/samples_stratified');
Map.addLayer(samples,  {}, 'samples', 0)

// DW built-up prob trends
var greyTrend = ee.Image('projects/nina/Arena/grey_trend_2018_2023_v3');

Map.addLayer(greyTrend, {min:-10, max:10, palette:['#d13328', 'white', '#00d6d5']}, 'trend',0)

// Define land mask
var wc = ee.ImageCollection("ESA/WorldCover/v200").mosaic();
var landMask = wc.neq(80);
Map.addLayer(landMask, {}, 'landMask', 0)

var clcplus = ee.Image('projects/nina/Europe_misc/CLMS_CLCplus_RASTER_2018_010m_eu_03035_V1_1');
clcplus = clcplus.remap(
  [1,2,3,4,5,6,7,8,9,10,11],
  [1,2,2,2,3,4,5,6,6, 7, 7]);

var nature = clcplus.neq(5).and(clcplus.neq(1));
Map.addLayer(nature, {min:0, max:1}, 'nature', 0);

var cropland = clcplus.eq(5)
Map.addLayer(cropland, {min:0, max:1}, 'cropland', 0);

var built = clcplus.eq(1)
Map.addLayer(built, {min:0, max:1}, 'built', 0);


function getStrataImg(lossTreshLow, lossTreshOptimal){
  // Create strata image for generating samples - buffer included as single stratum
  var strataImg = ee.Image(0)
    .where(nature, 1) // stable nature
    .where(built.or(cropland), 2) // stable other
    .where(greyTrend.gt(lossTreshLow).and(nature), 3) // loss buffer - nature
    .where(greyTrend.gt(lossTreshLow).and(nature.eq(0)), 4) // loss buffer - other
    .where(greyTrend.gt(lossTreshOptimal).and(nature), 5) // loss - nature
    .where(greyTrend.gt(lossTreshOptimal).and(cropland), 6) // loss - cropland
  // Apply land mask
  strataImg = strataImg.updateMask(landMask).selfMask();
  
  return strataImg
}

Map.addLayer(getStrataImg(3,5), {min:1, max:6, palette:['white', 'grey', 'orange', 'red', 'black', 'pink']}, 'strataImg', 0)

/***
 * 2. iterate over trend trehsolds and extract map labels and map areas --------------------------------+-------------------------------
 */

//// Countries ---------------------------------------
var countries = ee.FeatureCollection('users/zandersamuel/Global_misc/GISCO_CNT_RG_01M_2024');
Map.addLayer(countries, {}, 'countries raw', 0)
var selectedEEA = [
    "ALB",
    "AUT",
    "BEL",
    "BIH",
    "BGR",
    "CZE",
    "CYP",
    "DEU",
    "DNK",
    "ESP",
    "EST",
    "FIN",
    "FRA",
    "GBR",
    "GRC",  // "GRE", "GRC", // some datasets have either ISO code
    "HRV",
    "HUN",
    "IRL",
    "ITA",
    "ISL",
    "LIE",
    "LTU",
    "LUX",
    "LVA",
    "MKD",
    "MLT",
    "MNE",
    "NLD",
    "NOR",
    "POL",
    "PRT",
    "ROU",
    "SRB",
    "SVK",
    "SVN",
    "SWE",
    "TUR",
    "XKX",
    "CHE"]
print(selectedEEA.length)
// Define a geometry that excludes grid cells in South America and Africa
var excludeArea = /* color: #98ff00 */ee.Geometry({
      "type": "GeometryCollection",
      "geometries": [
        {
          "type": "Polygon",
          "coordinates": [
            [
              [
                1.7527057855936556,
                81.31775845273751
              ],
              [
                3.3347370355936556,
                73.74409530440026
              ],
              [
                38.315205785593655,
                72.88632759705337
              ],
              [
                40.776143285593655,
                79.53999751306542
              ],
              [
                39.369893285593655,
                81.31775845273751
              ]
            ]
          ],
          "evenOdd": true
        },
        {
          "type": "Polygon",
          "coordinates": [
            [
              [
                -63.50510371029064,
                24.63642145462176
              ],
              [
                -74.75510371029064,
                11.29627646126898
              ],
              [
                -54.36447871029064,
                -2.1644626175286628
              ],
              [
                -46.45432246029064,
                0.12017854256283018
              ],
              [
                -46.98166621029064,
                6.609377574331028
              ]
            ]
          ],
          "evenOdd": true
        },
        {
          "type": "Polygon",
          "coordinates": [
            [
              [
                42.83377898436505,
                -7.730745165510744
              ],
              [
                42.83377898436505,
                -15.980493877672831
              ],
              [
                56.19315398436504,
                -24.385270757831574
              ],
              [
                59.88456023436504,
                -20.15718470553273
              ]
            ]
          ],
          "geodesic": true,
          "evenOdd": true
        }
      ],
      "coordinates": []
    });
countries = countries.filter(ee.Filter.inList('ISO3_CODE', selectedEEA))
countries = countries.map(function(ft){return ft.difference(excludeArea)})
Map.addLayer(countries, {}, 'countries filtered', 0)

var grid = ee.FeatureCollection('projects/nina/Arena/export_grid')
Map.addLayer(grid, {}, 'export_grid', 0)

// Function to get strata area

function getStratAreas(stratImage, aoi,  scale, proj){
  
  // Calculate strata areas and group them
  var strataAreas = ee.Image.pixelArea().addBands(stratImage)
    .reproject(proj.atScale(scale))
    .reduceRegion({
      reducer: ee.Reducer.sum().group(1),
      geometry: aoi,
      scale: scale,
      maxPixels: 1e14,
      bestEffort: true
  });
  
  // Process groups to extract information server-side
  var groups = ee.List(strataAreas.get('groups'));
  
  var strataInfo = groups.map(function(group) {
    var dict = ee.Dictionary(group);
    dict = dict.rename(['sum', 'group'], ['area', 'stratum'])
    //var area = ee.Number(dict.get('sum'));
    return ee.Feature(null, dict);
  });
  strataInfo = ee.FeatureCollection(strataInfo)
  
  return strataInfo
  
}

var thresholds =  [3,4,5,6,7]
for (var t = 0; t<0; t++){
  
  var thresh = thresholds[t]
  
  var sample_trends = getStrataImg(thresh-2,thresh).sampleRegions({
    collection: samples, 
    scale:10, 
    geometries:false,
    projection: proj
  })
  
  Export.table.toDrive({
    collection: sample_trends,
    description: 'mapped_classes_' + String(thresh-2) + '_' + String(thresh),
    fileFormat:'CSV',
    folder: 'sensitivity_analysis_labels'
  })
}




var list= countries.reduceColumns(ee.Reducer.toList(), ['ISO3_CODE']).get('list').evaluate(function(list){
  print(list)
  
  //list = ['CYP']
  
  for (var t = 0; t<0; t++){
    
    var thresh = thresholds[t]
    
    for (var i = 0; i<38; i++){
      var id = list[i]
      var aoi = countries.filter(ee.Filter.eq('ISO3_CODE', id)).geometry();
      
      var strataImgCountry = getStrataImg(thresh-2,thresh).clip(aoi)
      
      var stratAreas = getStratAreas(strataImgCountry, aoi,  10, proj);
      
      stratAreas = stratAreas.map(function(ft){
        return ft.set('country', id)
      })
      
      Export.table.toDrive({
        collection: stratAreas,
        fileFormat: 'CSV',
        description: 'areas_' + String(id) + '_' + String(thresh-2) + '_' + String(thresh),
        folder: 'sensitivity_analysis_areas'
      })
      
      
      
    }
    
  }
  
  
})


/***
 * 3. iterate over buffer distances and extract map labels and map areas --------------------------------+-------------------------------
 */

var thresholds =  [0,1,2,3,4]
for (var t = 0; t<0; t++){
  
  var thresh = thresholds[t]
  
  var sample_trends = getStrataImg(thresh,5).sampleRegions({
    collection: samples, 
    scale:10, 
    geometries:false,
    projection: proj
  })
  
  Export.table.toDrive({
    collection: sample_trends,
    description: 'mapped_classes_' + String(thresh) + '_' + String(5),
    fileFormat:'CSV',
    folder: 'sensitivity_analysis_buffers_labels'
  })
}




var list= countries.reduceColumns(ee.Reducer.toList(), ['ISO3_CODE']).get('list').evaluate(function(list){
  print(list)
  
  //list = ['CYP']
  
  for (var t = 0; t<5; t++){
    
    var thresh = thresholds[t]
    
    for (var i = 0; i<38; i++){
      var id = list[i]
      var aoi = countries.filter(ee.Filter.eq('ISO3_CODE', id)).geometry();
      
      var strataImgCountry = getStrataImg(thresh,5).clip(aoi)
        
      var stratAreas = getStratAreas(strataImgCountry, aoi,  10, proj);
      
      stratAreas = stratAreas.map(function(ft){
        return ft.set('country', id)
      })
      
      Export.table.toDrive({
        collection: stratAreas,
        fileFormat: 'CSV',
        description: 'areas_' + String(id) + '_' + String(thresh) + '_' + String(5),
        folder: 'sensitivity_analysis_buffers_areas'
      })
      
      
      
    }
    
  }
  
  
})

