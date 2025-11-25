# eu-dw-landtake
Code supporting the paper "Europe’s land take: revealing loss of nature and cropland to artificial surfaces". Link to paper: XXX

The research was conducted in collaboration with Arena for Journalism in Europe and is published as a data journalism piece here: https://greentogrey.eu/

## Structure
- `r-scripts/`: Contains R scripts for processing and analyzing GEE data.
- `gee-scripts/`: Contains JavaScript scripts for GEE code editor.

## Setup Instructions
### Google Earth Engine
1. Access the GEE code editor: [https://code.earthengine.google.com](https://code.earthengine.google.com).
2. Upload and run scripts in the `gee-scripts/` folder.

### R Environment - R version 4.4.1
1. Install required R packages by listed at the top of each R script.

## Reproducing the results in the paper
To reproduce the figures in the manuscript, you can do the following:
1. Download the `data/` folder from this Zenodo repository:
2. Create an R project and copy and paste the `r-scripts/` and `data/` folders to the R project directory.
3. Create an `output/` folder in the same directory
4. Run the scripts in r-scripts in order of naming and you will get figures in the `output/` folder matching those in the paper

## Reproducing the entire workflow
To reproduce the entire workflow from scratch requires quite some effort because there are some manual steps required when moving data between Google Earth Egnine and the R environment. The reference data collection web application and the collaboration with journalists interpreting the samples was quite an iterative process and it is difficult to document all the small steps that were involved. However, the code code for the web application is made available.

The scripts are run in this order, with some hidden steps inbetween which are unfortunately difficult to document:
1. Run "gee-scripts/1_dw_months_derivation.js" in GEE. This gets the data necessary to identify the optimal months in the year for filtering Dynamic World before detecting land take.
2. Run "r-scripts/1_dynamic_world_months_select.R" in R. This uses the data from step 1 to identify optimal months. Output needs to be ingested back into GEE.
3. Run "gee-scripts/2_pilot_samples_generate.js" in GEE. This gets Dynamic World trend values for pilot samples to optimize the algorithm parameters. A prerequisite for this is having a pilot map of land take which was essentially generated with similar (un-uptimized) code to that in "4_dw_trend_generate.js".
4. Run "r-scripts/2_algorithm_parameter_test.r" in R. This identifies the optimal trend threshold and monthly filtering method for detecting land take.
5. Run "gee-scripts/4_dw_trend_generate.js" in GEE. This is the main script to generate the map of land take. It outputs a trend value of built probability scores which can be thresholded to classify land take in subsequent scripts.
6. Run "gee-scripts/5_strata_areas_extract.js" in GEE. This exports strata areas for each country which are used in R for area estimation.
7. Run "r-scripts/3_sample_allocation.R" in R. This allocates sample sizes to each strata.
8. Run "gee-scripts/6_stratified_samples_generate.js" in GEE. This stratifies samples per coutnry per stratum. It generates more samples than needed. They are then pruned to the sample sizes defined in step 7.
9. Run "r-scripts/4_land_take_visualize.R" in R. This simply visualizes the distribution of land take over Europe using exports from step 6 above.
10. Run "r-scripts/5_area_estimation.R" in R. This is the core script for area estimation and visualizing results.
11. Run "r-scripts/6_overlap_analysis.R" in R. This is a pixel counting of overlap between our map and CLC. Uses outputs from step 6 above.
12. Run "gee-scripts/7_sensitivity_analysis_export.js" in GEE. This exports strata areas for different linear trend thresholds and buffer delineations.
13. Run "r-scripts/7_sensitivity_analysis.R" in R. This processes the data from previous step and visualizes results.

In between steps 8 and 10 in the above sequence is perhaps the most vital piece of the entire workflow: the reference data collection. We used an app hosted in Google Earth Engine Apps which pushed data to a Google Sheet database. The app source code is provided here: "gee-scripts/sampling_app.js" The app will of course have to be adjusted so that it references GEE assets that are not private/outdated.

