# Context
- South Pole is an environmental consultant that trades carbon credits. 
- The BigQuery datamarts belong to SouthPole.
- The QCI dataset is data from a third party which has been uploaded as qci_cad_salesforce_ew1.qci_raw. This shows all transaction (txn) data. 
- 

## **Question**
- Which companies purchase (or purchased) from South Pole, and are now (also) buying from others? 
- Which carbon projects are those companies buying, and what volumes of CO2 or value or transaction? 

### Raw inputs
- QCI:
	- qci_cad_salesforce_ew1.qci_raw
- CAD:
	- mart_external_carbon_registries.cad_projects
	- mart_external_carbon_registries.cad_units
- PCG:
	- mart_external_carbon_registries.verra_private_transactions_enriched
- SouthPole
	- mart_salesforce.account (always include account_status)
	- mart_salesforce.opportunity (always include stage_name)
- And anything else you can find in the datamarts which might be useful. 

### Status now
- data-marts-sp.qci_cad_salesforce_ew1.qci_enriched_verra shows qci data enriched with matching verra projects.
* data-marts-sp.qci_cad_salesforce_ew1.qci_enriched_verra_v2 shows qci_enriched_verra enriched with matching salesforce account id. 

### Output to show
-  Company transactions grid: 
       * Rows: Company names.
       * Columns: Years.
       * Cell Values: The number of transactions. Provide two separate columns for each year: one for South Pole transactions and one for third-party transactions. Color-code them as you see fit.

   2. Detailed transaction data: For the companies identified in the grid, provide a more detailed breakdown of their third-party transactions, including:
       * Project names/IDs.
       * CO2 volumes (quantity).
       * Vintage year.



### Process



### Problems
- getting 90k matches (qci_cad_salesforce_ew1.qci_enriched_verra) but not matching on geopost for some reason
- This implies that prospect and closed_won are not mutually exclusive. From https://colab.research.google.com/drive/1WMqgtGWiFuVauAwcRfUopBxkN2MJ45nA#scrollTo=UmyqZ7NnI735 

💼 Analyzing Salesforce customer data... ✅ Found 4,013 SF customers with won deals 📈 CUSTOMER STATUS SUMMARY: ------------------------------------------------------------ Existing Customer : 874 customers | € 448,603,792 revenue Pending Customer : 857 customers | € 291,409,803 revenue Past Customer : 925 customers | € 156,898,483 revenue Qualified : 140 customers | € 343,560,239 revenue New Customer : 242 customers | € 43,176,199 revenue Prospect : 357 customers | €1,851,178,736 revenue Past Client : 618 customers | € 62,183,444 revenue