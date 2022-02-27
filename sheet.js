require('dotenv-json')()

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

var doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID)

doc.useServiceAccountAuth(creds, function(err) {
    if (err) {
        console.log(err)
    }

    const newRow = { guid: "azd", message: 'hello' }
    return doc.addRow(1, newRow, function(err) {
        if (err) {
            console.log(err)
        }
    })
})
