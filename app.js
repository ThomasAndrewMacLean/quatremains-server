//require('dotenv-json')()
const crypto = require('crypto')
const express = require('express')
const fetch = require('node-fetch')
var cors = require('cors')
const nodemailer = require('nodemailer')
const YOUR_EMAIL = 'anders@quatremains.gent'
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        type: 'OAuth2',
        user: YOUR_EMAIL,
        serviceClient: process.env.MAILER_CLIENT_ID,
        privateKey: process.env.MAILER_PRIVATE_KEY,
    },
})

const transporterThomas = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        type: 'OAuth2',
        user: 'hello@thomasmaclean.be',
        serviceClient: process.env.MAILER_CLIENT_ID,
        privateKey: process.env.MAILER_PRIVATE_KEY,
    },
})

var GoogleSpreadsheet = require('google-spreadsheet')
var creds = {
    type: 'service_account',
    project_id: 'quatremains',
    client_email: 'spreadsheeter@quatremains.iam.gserviceaccount.com',
    client_id: '117006588786518178996',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url:
        'https://www.googleapis.com/robot/v1/metadata/x509/spreadsheeter%40quatremains.iam.gserviceaccount.com',
}

creds.private_key_id = process.env.PRIVATE_KEY_ID
creds.private_key = process.env.PRIVATE_KEY

//var doc = new GoogleSpreadsheet(process.env.TEST_GOOGLE_SHEET_ID)

const app = express()
app.use(cors())

app.use(express.json())

// check if req comes from our website.
//app.use(auth())

//const port = 3000

app.get('/', (req, res) => res.send('Hello World!'))

app.get('/pianos', (_, res) => {
    var doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID)

    try {
        return doc.useServiceAccountAuth(creds, function(err) {
            if (err) {
                console.log(err)
            }

            return doc.getRows(3, function(err, rows) {
                if (err) {
                    res.status(500).json({ err })
                }
                const {
                    // eslint-disable-next-line no-unused-vars
                    _xml,
                    // eslint-disable-next-line no-unused-vars
                    id,
                    // eslint-disable-next-line no-unused-vars
                    _links,
                    // eslint-disable-next-line no-unused-vars
                    save,
                    // eslint-disable-next-line no-unused-vars
                    del,
                    // eslint-disable-next-line no-unused-vars
                    korting,
                    // eslint-disable-next-line no-unused-vars
                    piano,
                    // eslint-disable-next-line no-unused-vars

                    ...rawPianos
                } = rows[1]

                return res.json({
                    pianos: Object.values(rawPianos).filter(
                        p => !p.includes(':')
                    ),
                })
            })
        })
    } catch (error) {
        return res.json({ error })
    }
})

app.post('/getDistance', (req, res) => {
    var doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID)
    const { calculateDistance } = req.body

    return doc.useServiceAccountAuth(creds, function(err) {
        if (err) {
            console.log(err)
        }

        const { street, number, postcode, city } = req.body.formData
        const newRow = req.body.formData
        newRow.piano = req.body.piano
        newRow.guid = crypto.randomBytes(16).toString('hex')

        if (!calculateDistance) {
            // we only calculate the price, no need to check distance
            return calculatePrice(doc, req, res, newRow, 0)
        }

        const getLonLatApi =
            `https://maps.googleapis.com/maps/api/geocode/json?address=${street}+${number}+${postcode}+${city}` +
            '&key=' +
            process.env.GEO_CODE_API_KEY

        return fetch(getLonLatApi)
            .then(x => x.json())
            .then(y => {
                if (y.status !== 'OK') {
                    //error
                }
                const location = y.results[0].geometry.location
                const latLng = location.lat + ',' + location.lng

                const googleDistanceApi =
                    'https://maps.googleapis.com/maps/api/directions/json?origin=51.064319,3.7575259&destination=' +
                    latLng +
                    '&key=' +
                    process.env.MAPS_API_KEY

                return fetch(googleDistanceApi)
                    .then(x => x.json())
                    .then(data => {
                        const numberOfMeters =
                            data.routes[0].legs[0].distance.value

                        newRow.distance = numberOfMeters

                        calculatePrice(doc, req, res, newRow, numberOfMeters)
                    })
            })
    })
})

app.post('/rent', (req, res) => {
    var doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID)

    return doc.useServiceAccountAuth(creds, function(err) {
        if (err) {
            console.log(err)
        }

        return doc.getRows(1, function(error, rows) {
            if (error) {
                console.log(error)
            }

            let distanceRow = rows.find(x => x.guid === req.body.formData.guid)

            console.log(distanceRow)
            const newRow = req.body.formData
            newRow.piano = req.body.piano
            if (distanceRow) {
                newRow.distance = distanceRow.distance
                newRow.price = distanceRow.price
                newRow.pricediscount = distanceRow.pricediscount
            }

            newRow.contactdata =
                req.body.formData.firstname +
                ' ' +
                req.body.formData.lastname +
                ' ' +
                req.body.formData.company
            newRow.addressdata =
                req.body.formData.street +
                ' ' +
                req.body.formData.number +
                ', ' +
                req.body.formData.postcode +
                ' ' +
                req.body.formData.city

            return doc.addRow(1, newRow, function(err) {
                if (err) {
                    console.log(err)
                }

                if (distanceRow) {
                    return distanceRow.del(function(err) {
                        if (err) {
                            console.log(err)
                        }

                        return res.json(newRow)
                    })
                } else {
                    return res.json(newRow)
                }
            })
        })
    })
})

const calculatePrice = (doc, req, res, newRow, numberOfMeters) => {
    return doc.getRows(3, function(err, rows) {
        // eslint-disable-next-line no-unused-vars
        const { _xml, id, _links, ...prijzen } = rows[0]

        for (var key in prijzen) {
            var temp
            // eslint-disable-next-line no-prototype-builtins
            if (prijzen.hasOwnProperty(key)) {
                temp = prijzen[key]
                delete prijzen[key]
                prijzen[
                    key
                        .split(' ')
                        .join('')
                        .toUpperCase()
                ] = temp
            }
        }

        console.log(prijzen)

        const price =
            prijzen[
                req.body.piano
                    .split('-')
                    .join('')
                    .split(' ')
                    .join('')
                    .toUpperCase()
            ]

        const emailClient = req.body.formData.email

        if (prijzen.KORTING.includes(emailClient)) {
            newRow.pricediscount =
                parseFloat(price * 0.9) +
                (parseFloat(req.body.prijsperkilometer) * numberOfMeters) / 1000
        }

        console.log(price)

        const totalPrice =
            parseFloat(price) +
            (parseFloat(req.body.prijsperkilometer) * numberOfMeters) / 1000

        console.log(totalPrice)
        newRow.price = totalPrice
        return doc.addRow(1, newRow, function(err) {
            if (err) {
                console.log(err)
            }

            return res.json(newRow)
        })
    })
}

app.post('/mail/:language', (req, res) => {
    return transporter.verify().then(x => {
        console.log(x)
        let htmlBody = mailBody
            .replace('TEXT', req.body.template)
            .replace('NAME', req.body.formData.lastname)
            .replace('PIANO', req.body.piano)
            .replace(
                'DATE',
                req.body.formData.date
                    .split('-')
                    .reverse()
                    .join('/')
            )
            .replace(
                'ADDRESS',
                req.body.formData.street +
                    ' ' +
                    req.body.formData.number +
                    ', ' +
                    req.body.formData.postcode +
                    ' ' +
                    req.body.formData.city
            )
            .replace('MESSAGE', req.body.formData.message)
        return transporter
            .sendMail({
                from: YOUR_EMAIL,
                to: req.body.formData.email,

                subject: (req.body.subject || '').replace(
                    'PIANO',
                    req.body.piano
                ),
                html: htmlBody,
                replyTo: 'mail@quatremains.gent',
            })
            .then(y => {
                console.log(y)
                return res.json('mail sent')
            })
    })
})

app.post('/confirmmail/:language', (req, res) => {
    return transporterThomas.verify().then(() => {
        let htmlBody = mailBody
            .replace('TEXT', req.body.template)
            .replace('NAME', req.body.formData.lastname)
            .replace('PIANO', req.body.piano)
            .replace(
                'DATE',
                req.body.formData.date
                    .split('-')
                    .reverse()
                    .join('/')
            )
            .replace(
                'ADDRESS',
                req.body.formData.street +
                    ' ' +
                    req.body.formData.number +
                    ', ' +
                    req.body.formData.postcode +
                    ' ' +
                    req.body.formData.city
            )
            .replace('MESSAGE', req.body.formData.message)
        return transporterThomas
            .sendMail({
                to: req.body.bevestigingsmail,
                cc: 'mail@quatremains.gent',
                subject:
                    'Mail verstuurd naar ' +
                    req.body.formData.email +
                    '  => ' +
                    (req.body.subject || '').replace('PIANO', req.body.piano),
                html: htmlBody,
            })
            .then(() => {
                return res.json('mail sent')
            })
    })
})

app.get('/labels/:language', (req, res) => {
    var doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID)

    doc.useServiceAccountAuth(creds, function(err) {
        console.log(err)
        doc.getRows(2, function(err, rows) {
            const languageRow =
                req.params.language.toUpperCase() !== 'NL' ? 0 : 1
            // eslint-disable-next-line no-unused-vars
            const { _xml, id, _links, ...result } = rows[languageRow]
            res.send(result)
        })
    })
})

app.get('/prices', (req, res) => {
    var doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID)

    doc.useServiceAccountAuth(creds, function(err) {
        console.log(err)
        doc.getRows(3, function(err, rows) {
            // eslint-disable-next-line no-unused-vars
            const { _xml, id, _links, ...result } = rows[0]
            res.send(result)
        })
    })
})

app.get('/available/:piano', (req, res) => {
    var doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID)

    doc.useServiceAccountAuth(creds, function(err) {
        console.log(err)
        doc.getRows(1, function(err, rows) {
            const rowsPiano = rows
                .filter(
                    r =>
                        ((r.goedgekeurd || '').toUpperCase() === 'TRUE' ||
                            (r.goedgekeurd || '').toUpperCase() === 'WAAR') &&
                        r.piano === req.params.piano
                )
                .map(p => p.date)
            res.send(rowsPiano)
        })
    })
})

module.exports = app
//app.listen(3000, () => console.log(`Example app listening on port 3000!`))

const mailBody = `<!doctype html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><title></title><!--[if !mso]><!-- --><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]--><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style type="text/css">#outlook a { padding:0; }
.ReadMsgBody { width:100%; }
.ExternalClass { width:100%; }
.ExternalClass * { line-height:100%; }
body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
p { display:block;margin:13px 0; }</style><!--[if !mso]><!--><style type="text/css">@media only screen and (max-width:480px) {
  @-ms-viewport { width:320px; }
  @viewport { width:320px; }
}</style><!--<![endif]--><!--[if mso]>
<xml>
<o:OfficeDocumentSettings>
<o:AllowPNG/>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
<![endif]--><!--[if lte mso 11]>
<style type="text/css">
.outlook-group-fix { width:100% !important; }
</style>
<![endif]--><style type="text/css">@media only screen and (min-width:480px) {
.mj-column-per-100 { width:100% !important; max-width: 100%; }
}</style><style type="text/css">@media only screen and (max-width:480px) {
table.full-width-mobile { width: 100% !important; }
td.full-width-mobile { width: auto !important; }
}</style></head><body><div><!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]--><div style="Margin:0px;max-width:600px;"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"><tbody><tr><td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;vertical-align:top;"><!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]--><div class="mj-column-per-100 outlook-group-fix" style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"><tr><td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"><div style="font-family:helvetica;font-size:17px;line-height:1;text-align:left;color:#333333;">TEXT</div></td></tr><tr><td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px;"><tbody><tr><td style="width:150px;"><img height="auto" src="https://storage.googleapis.com/quatremainsbucket/quatremainslogo.gif" style="border:0;display:block;outline:none;text-decoration:none;height:auto;width:100%;" width="150"></td></tr></tbody></table></td></tr><tr><td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"><div style="font-family:helvetica;font-size:15px;line-height:1;text-align:left;color:#333333;">+32 9 233 80 59<br>Kwaadham 52<br>B - 9000 Gent<br>www.quatremains.gent</div></td></tr></table></div><!--[if mso | IE]></td></tr></table><![endif]--></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></div></body></html>`
