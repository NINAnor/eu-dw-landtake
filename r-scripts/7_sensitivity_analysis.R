library(tidyverse)
library(purrr)
library(mapaccuracy)

# Reference samples 
referenceSamples <- read_csv('./data/reference_samples_clean_final.csv')
length(unique(referenceSamples$PLOTID))
nrow(referenceSamples)


#### Sensitivity analysis: effect of threshold on accuracy and area estimates --------------------

# Read in mapped labels for samples
read_file <- function(file_path) {
  # Extract x and y values from filename, assuming format like "mapped_classes_1_3.csv"
  file_name <- basename(file_path)
  matches <- str_match(file_name, "mapped_classes_(\\d+)_(\\d+)\\.csv")
  buff_thresh <- as.numeric(matches[2])
  thresh <- as.numeric(matches[3])
  
  # Read and annotate
  read_csv(file_path) %>%
    mutate(buff_thresh = buff_thresh, thresh = thresh)
}

# Get list of files
files <- list.files('./data/From_Gee/sensitivity_analysis_labels', full.names = TRUE)

# Read and combine
mappedSamples_sens_raw <- map_dfr(files, read_file) 
mappedSamples_sens <- map_dfr(files, read_file) %>%
  mutate(m = ifelse(constant == 1, 'nature stable',
                          ifelse(constant == 2, 'crop/built stable',
                                 ifelse(constant == 3, 'buffer nature stable',
                                        ifelse(constant == 4, 'buffer crop/built stable',
                                               ifelse(constant == 5, 'nature loss', 
                                                      ifelse(constant == 6, 'cropland loss', NA))))))) %>%
  dplyr::select(PLOTID, m, buff_thresh, thresh)%>%
  distinct(PLOTID,  m, buff_thresh, thresh)
mappedSamples_sens %>%
  ggplot(aes(x=m)) +
  geom_bar() +
  facet_wrap(~factor(buff_thresh)) +
  coord_flip()

# Merge mapped and reference samples
mergedSamples_sens <- mappedSamples_sens %>% 
  left_join(referenceSamples,  by = 'PLOTID') %>%
  ungroup( )%>%
  drop_na(r)
colSums(is.na(mergedSamples_sens))


# Import and label mapped areas from GEE - these are the pixel counting areas

read_area_file <- function(file_path) {
  file_name <- basename(file_path)
  
  # Match "areas_<ISO3>_<buff>_<thresh>.csv"
  match <- str_match(file_name, "^areas_([A-Z]{3})_(\\d+)_(\\d+)\\.csv$")
  
  buff_thresh <- as.numeric(match[3])
  thresh <- as.numeric(match[4])
  
  # Read and annotate
  read_csv(file_path) %>%
    mutate(buff_thresh = buff_thresh, thresh = thresh)%>%
    mutate(stratum = ifelse(stratum == 1, 'nature stable',
                            ifelse(stratum == 2, 'crop/built stable',
                                   ifelse(stratum == 3, 'buffer nature stable',
                                          ifelse(stratum == 4, 'buffer crop/built stable',
                                                 ifelse(stratum == 5, 'nature loss', 
                                                        ifelse(stratum == 6, 'cropland loss', NA))))))) %>%
    group_by(country, stratum, buff_thresh, thresh) %>%
    # Area in km2
    summarise(area = sum(area)/1000000) %>%
    # correct for Greece ISO3 code
    mutate(country = ifelse(country == 'GRE', 'GRC', country))
}

files_areas <- list.files('./data/From_Gee/sensitivity_analysis_areas', full.names = TRUE)

areas_sens <- map_dfr(files_areas, read_area_file)
unique(areas_sens$thresh)

# Check if missing values or extra values
areas_sens %>% group_by(country) %>% count() %>% filter(n != 30)

# Get original strata areas and strata labels
Nh_strata <- areas_sens %>%
  filter(thresh == 5) %>%
  mutate(stratum = ifelse(str_detect(stratum, 'loss'), 'land take',stratum)) %>%
  group_by(stratum) %>%
  summarise(area = sum(area)) %>%
  deframe()

s <- mergedSamples_sens %>%
  filter(thresh == 5) %>%
  mutate(r = ifelse(str_detect(r, 'loss'), 'land take',r)) %>%
  mutate(m = ifelse(str_detect(m, 'loss'), 'land take',m))%>%
  ungroup() %>%
  pull(m)

# Dataframe to house outputs of loop
EUareasEstOut_sens <- tibble()

t <- 3
for (t in c(3,4,5,6,7)){
  
  mergedSamples_sens_sel <- mergedSamples_sens %>% filter(thresh == t)
  
  areas_sens_sel <- areas_sens %>% filter(thresh == t)
  
    
  areasEU_sens <- areas_sens_sel %>%
    mutate(stratum = ifelse(str_detect(stratum, 'loss'), 'land take',stratum)) %>%
    group_by(stratum) %>%
    summarise(area = sum(area))
  sum(areasEU_sens$area)
  
  combinedEU_sens <- mergedSamples_sens_sel %>%
    mutate(r = ifelse(str_detect(r, 'loss'), 'land take',r)) %>%
    mutate(m = ifelse(str_detect(m, 'loss'), 'land take',m))%>%
    ungroup()
    
  
  Nh<-areasEU_sens %>%
    deframe()
  
  combinedEUForEstimation_sens <- combinedEU_sens %>%
    #mutate(r= ifelse(r == 'buffer nature stable', 'nature stable', 
    #                 ifelse(r == 'buffer crop/built stable', 'crop/built stable', r))) %>%
    dplyr::select(PLOTID, r, m)
  
  # nrow(combinedEUForEstimation_sens)
  # nrow(combinedEUForEstimation)
  # View(anti_join(combinedEUForEstimation_sens, combinedEUForEstimation))
  
  unique(s)
  unique(combinedEUForEstimation_sens$r)
  unique(combinedEUForEstimation_sens$m)
  e <- stehman2014(s, combinedEUForEstimation_sens$r, combinedEUForEstimation_sens$m, Nh_strata)
  
  # Get the confusion matrix
  conf_matrix <- e$matrix
  
  # Extract all values from the column corresponding to reference = "land take"
  land_take_col <- conf_matrix[, "land take"]
  
  # Total reference area for land take
  total_land_take <- land_take_col['sum']
  
  # Filter rows (map classes) that are buffer classes
  omission_to_buffer <- land_take_col[names(land_take_col) %in% c("buffer crop/built stable", "buffer nature stable")]
  
  # Sum of omitted land take into buffer
  omission_sum <- sum(omission_to_buffer, na.rm = TRUE)
  
  # Proportion of omitted land take into buffer
  omission_rate_to_buffer <- omission_sum / total_land_take
  
  
  
  changeDF <- tibble()
  for (i in seq(1, length(e$area))) {
    ua_i <- e$UA[i]
    pa_i <- e$PA[i]
    e$SEoa * qnorm(0.975)
    subChangeDF <- tibble(
      stratum = names(e$area)[i],
      area = e$area[i] * sum(Nh),
      prop = e$area[i],
      se = e$SEa[i] * sum(Nh),
      pa = pa_i,
      ua = ua_i,
      seUa = e$SEua[i],
      sePa = e$SEpa[i],
      oa = e$OA,
      omis_lt_buff = omission_rate_to_buffer,
      ciArea = qnorm(0.975) * e$SEa[i] * sum(Nh),
      f1 = ifelse((ua_i + pa_i) > 0, 2 * ua_i * pa_i / (ua_i + pa_i), NA_real_)
    )
    changeDF <- changeDF %>% bind_rows(subChangeDF)
  }
  changeDF$Nh <- Nh
  changeDF$thresh <- t
  
  EUareasEstOut_sens <- EUareasEstOut_sens %>%
    bind_rows(changeDF)
    
  
}


View(EUareasEstOut_sens  %>%
       dplyr::select(stratum, Nh))

# Get pixel counting areas which are not separated out into buffer zones
# Need to subsume into the stable class
NhTotsEU_sens <- EUareasEstOut_sens %>%
  mutate(stratum = str_remove(stratum, 'buffer ')) %>%
  group_by(stratum, thresh) %>%
  summarise(area_mapped = sum(Nh))

# Join back with output
EUareasEstOut_sens <- EUareasEstOut_sens %>%
  filter(!str_detect(stratum, 'buffer')) %>%
  dplyr::select(-Nh) %>%
  left_join(NhTotsEU_sens)

View(EUareasEstOut_sens %>%
       filter(stratum == 'land take') %>%
       # Convert to annual rate
       mutate_at(vars(area, ciArea, area_mapped), function(x) x/6) )


sp1 <- EUareasEstOut_sens %>%
  filter(str_detect(stratum, 'land take')) %>%
  # Convert threshold to original Dynamic World scale
  mutate(thresh = thresh / 100) %>%
  dplyr::select(thresh, `Producer's accuracy`=pa, `User's accuracy`=ua, `F1 score`=f1) %>%
  gather(key, val, `Producer's accuracy`, `User's accuracy`, `F1 score`) %>%
  ggplot(aes(x=thresh, y = val, color=key)) +
  geom_point(position = position_dodge(0)) +
  labs(color="Accuracy metric",
       x = "Linear trend threshold for\n defining land take",
       y = "Land take accuracy",
       title = "a") +
  theme(legend.title = element_blank(),
        legend.position = c(0.7, 0.85),
        legend.key = element_rect(fill='white'),
        legend.background = element_rect(fill=NA))
sp1

spAreas <- EUareasEstOut_sens %>%
  # Convert to annual rate
  mutate_at(vars(area, ciArea, area_mapped), function(x) x/6) %>%
  filter(stratum == 'land take') %>%
  dplyr::select(thresh, `Pixel count`=area_mapped, `Design-based`=area, ciArea) %>%
  gather(key, area, -thresh, -ciArea) %>%
  mutate(ciArea = ifelse(key == "Pixel count", NA, ciArea)) %>%
  # Convert threshold to original Dynamic World scale
  mutate(thresh = thresh / 100)

sp2 <- spAreas %>%
  ggplot(aes(x=thresh, y = area, color=key)) +
  geom_point() +
  geom_errorbar(data = spAreas %>% filter(key == 'Design-based'),
                aes(ymax=area-ciArea, ymin=area+ciArea), width=0, linewidth=0.8) +
  labs(x = "Linear trend threshold for\n defining land take",
       y = expression("Land take area estimate ("~km^2~")"),
       title = "b") +
  theme(legend.title = element_blank(),
        legend.position = c(0.7, 0.7),
        legend.key = element_rect(fill='white'),
        legend.background = element_rect(fill=NA))
sp2

sensPlot <- grid.arrange( sp1, sp2, ncol=2,
                          padding = unit(0, "line"),widths=c(1,1), newpage = T)

ggsave("./output/sensPlot.png", sensPlot, width = 20, height=12, units='cm')
