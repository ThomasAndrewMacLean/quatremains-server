const express = require('express')
//const fetch = require('node-fetch')
var cors = require('cors')

var GoogleSpreadsheet = require('google-spreadsheet')
var creds = require('./client_secret.json')
var doc = new GoogleSpreadsheet('1iGXTpvXXRtZhkcv-G6RY4uFfn-y7_R3LfscYzbct96Y')

const app = express()
app.use(cors())

app.use(express.json())

// check if req comes from our website.
//app.use(auth())

const port = 3000

app.get('/', (req, res) => res.send('Hello World!'))

app.post('/getDistance', (req, res) => {
    doc.useServiceAccountAuth(creds, function(err) {
        if (err) {
            console.log(err)
        }

        const newRow = req.body
        newRow.distance = Math.floor(Math.random() * 100)

        console.log(newRow)

        doc.addRow(1, newRow, function(err) {
            if (err) {
                console.log(err)
            }
            res.send('')
        })
    })
})

app.get('/labels/:language', (req, res) => {
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
    doc.useServiceAccountAuth(creds, function(err) {
        console.log(err)
        doc.getRows(1, function(err, rows) {
            const rowsPiano = rows
                .filter(
                    r =>
                        (r.goedgekeurd || '').toUpperCase() === 'OK' &&
                        r.piano === req.params.piano
                )
                .map(p => p.date)
            res.send(rowsPiano)
        })
    })
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
