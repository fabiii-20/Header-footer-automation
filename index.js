const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const ExcelJS = require('exceljs');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Function to get the last segment after the last slash
const getLastSegment = (url) => {
    if (!url) return '';
    const parts = url.split('/');
    return parts[parts.length - 1];
};

// Function to get the first segment after the first slash (Partner ID)
const getPartnerId = (url) => {
    if (!url) return '';
    const parts = url.split('/');
    return parts.length > 1 ? parts[1] : '';
};

// Remove "fromService: True" and "fromService: False" and surrounding commas
const removeFromServiceFlags = (footprint) => {
    if (!footprint) return '';
    return footprint
        .replace(/,?\s*fromService:\s*(True|False)\s*,?/g, '') // Removes both True and False flags
        .trim();
};

// Categorize the site based on header and footer footprints
const categorizeSite = (headerFootprint, footerFootprint) => {
    if (headerFootprint === 'MSDigitalLiteracyRedTigerHeader' && footerFootprint === 'MSDigitalLiteracyFooter') {
        return 'Digital Literacy';
    } else if (headerFootprint === 'MSPugetSoundHeader' && footerFootprint === 'MSPugetSoundFooter') {
        return 'Puget Sound';
    } else if (headerFootprint === 'MSRacialEquityHeader' && footerFootprint === 'MSRacialEquityFooter') {
        return 'REI';
    } else if (headerFootprint === 'MSTealsHeader' && footerFootprint === 'MSTealsFooter') {
        return 'TEALS';
    } else if (headerFootprint === 'MSMicrosoftUnifiedHeader' && footerFootprint === 'MSMicrosoftUnifiedFooter') {
        return 'Microsoft Unified';
    } else if (headerFootprint === 'mshomeheader' && footerFootprint === 'mshomefooter') {
        return 'Premier Support';
    } else if (headerFootprint === 'MSAboutHeader-w-Nav' && footerFootprint === 'MSaboutFooter') {
        return 'About';
    } else if (headerFootprint === 'msaccessibilityheader' && footerFootprint === 'msaccessibilityfooter') {
        return 'Accessibility';
    } else if (headerFootprint === 'MSCorporateResponsibilityHeader3' && footerFootprint === 'MSCorporateResponsibilityFooter') {
        return 'CSR';
    } else if (headerFootprint === 'MSElectionsHeader' && footerFootprint === 'MSElectionsFooter') {
        return 'CSR > Elections';
    } else if (headerFootprint === 'MSNonprofitsHeader' && footerFootprint === 'MSNonProfitsFooter') {
        return 'Nonprofits';
    } else {
        return 'Others';
    }
};

app.post('/fetch-footprint', async (req, res) => {
    const { links } = req.body;

    if (!Array.isArray(links) || links.length === 0) {
        return res.status(400).json({ message: 'Please provide valid links.' });
    }

    const results = [];

    for (let link of links) {
        try {
            const response = await axios.get(link);
            const html = response.data;
            const $ = cheerio.load(html);

            let headerFootprint = $('header').attr('data-header-footprint');
            let footerFootprint = $('footer').attr('data-footer-footprint');

            // Remove "fromService: True" and "fromService: False" and surrounding commas
            headerFootprint = removeFromServiceFlags(headerFootprint);
            footerFootprint = removeFromServiceFlags(footerFootprint);

            // Extract the string after the last slash (header/footer)
            const headerLastSegment = getLastSegment(headerFootprint);
            const footerLastSegment = getLastSegment(footerFootprint);

            // Extract the Partner ID (string after the first slash)
            const headerPartnerId = getPartnerId(headerFootprint);
            const footerPartnerId = getPartnerId(footerFootprint);

            const category = categorizeSite(headerLastSegment, footerLastSegment);

            results.push({
                link,
                headerPartnerId: headerPartnerId || 'Not found',
                footerPartnerId: footerPartnerId || 'Not found',
                headerFootprint: headerLastSegment || 'Not found',
                footerFootprint: footerLastSegment || 'Not found',
                category,
            });
        } catch (error) {
            results.push({
                link,
                headerPartnerId: 'Not found',
                footerPartnerId: 'Not found',
                headerFootprint: 'Not found',
                footerFootprint: 'Not found',
                category: 'Others',
            });
        }
    }

    // Create an Excel workbook and add a worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Footprints');

    // Add column headers
    worksheet.columns = [
        { header: 'Page (URL)', key: 'link', width: 50 },
        { header: 'Header Partner ID', key: 'headerPartnerId', width: 30 },
        { header: 'Footer Partner ID', key: 'footerPartnerId', width: 30 },
        { header: 'Header', key: 'headerFootprint', width: 30 },
        { header: 'Footer', key: 'footerFootprint', width: 30 },
        { header: 'Site (Category)', key: 'category', width: 20 },
    ];

    // Add rows
    results.forEach(result => {
        worksheet.addRow(result);
    });

    // Write the workbook to a buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Send the buffer as an Excel file
    res.setHeader('Content-Disposition', 'attachment; filename=footprints.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
