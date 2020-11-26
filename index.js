//inisialisasi library
const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")
const mysql = require("mysql")
const md5 = require('md5') 
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const Cryptr = require("cryptr")
const crypt = new Cryptr("123456789098")
const moment = require("moment")

//implementation
const app = express()
app.use(express.static(__dirname))
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended : true}))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded ({ extended : true }))

//config upload file process
const storage = multer.diskStorage({
    destination : (req, file, cb) => {
        //set file storage
        cb(null, './image')
    },
    filename : (req, file, cb) => {
        //generate file name
        cb(null, "image-"+ Date.now() + path.extname(file.originalname))
    }
})

let upload = multer({storage : storage})

//create mysql connection
const db = mysql.createConnection ({
    host : "localhost",
    user : "root",
    password : "",
    database : "penyewaan_mobil"
})

db.connect(error => {
    if (error) {
        console.log(error.message)
    } else {
        console.log("MySQL Connected!")
    }
})

validateToken = () => {
    return (req, res, next) => {
        if (!req.get("Token")) {
            res.json ({
                message : "Access Forbidden"
            })
        } else {
            let token = req.get("Token")

            let decryptToken = crypt.decrypt(token)

            let sql = "select * from karyawan where ?"

            let param = { id_karyawan : decryptToken }

            db.query(sql, param, (error, result) => {
                if (error) throw error 

                if (result.length > 0) {
                    next()
                } else {
                    res.json ({
                        message : "Invalid Token"
                    })
                }
            })
        }
    }
}

//endpoint login karyawan
app.post("/karyawan/auth", (req, res) => {
    let param = [
        req.body.username,
        md5(req.body.password)
    ]

    let sql = "select * from karyawan where username = ? and password = ?"

    db.query(sql, param, (error, result) => {
        if (error) throw error

        if (result.length > 0) {
            res.json ({
                message : "Logged",
                token : crypt.encrypt(result[0].id_karyawan),
                data : result 
            })
        } else {
            res.json ({
                message : "Invalid username/password"
            })
        }
    })
})

//TABEL MOBIL
//endpoint akses data mobil
app.get("/mobil", validateToken(), (req, res) => {
    //create sql query
    let sql = "select * from mobil"

    //run query
    db.query(sql, (error, result) => {
        let response = null
        if (error) {
            response = {
                message : error.message //pesan error
            }
        } else {
            response = {
                count : result.length, //jumlah data
                mobil : result //isi data
            }
        }

        res.json(response) //send response
    })
})

//endpoint akses data mobil berdasarkan id_mobil tertentu
app.get("/mobil/:id_mobil", validateToken(), (req, res) => {
    let data = {
        id_mobil : req.params.id_mobil
    }

    //create sql query
    let sql = "select * from mobil where ?"

    //run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message : error.message //pesan error
            }
        } else {
            response = {
                count : result.length, //jumlah data
                mobil : result //isi data
            }
        }

        res.json(response) //send response
    })
})

//endpoint menyimpan data mobil
app.post("/mobil", upload.single("image"), validateToken(), (req, res) => {
    //prepare data
    let data = {
        id_mobil : req.body.id_mobil,
        nomor_mobil : req.body.nomor_mobil,
        merk : req.body.merk,
        jenis : req.body.jenis,
        warna : req.body.warna,
        tahun_pembuatan : req.body.tahun_pembuatan,
        biaya_sewa_per_hari : req.body.biaya_sewa_per_hari,
        image : req.file.filename
    }

    if (!req.file) {
        //jika tidak ada file yang diupload
        res.json ({
            message : "Tidak ada file yang dikirim"
        })
    } else {
        //create sql insert
        let sql = "insert into mobil set ?"

        //run query
        db.query(sql, data, (error, result) => {
            if (error) throw error
            res.json ({
                message : result.affectedRows + " data inserted"
            })
        })
    }
})

//endpoint mengubah data mobil
app.put("/mobil", upload.single("image"), validateToken(), (req, res) => {
    let data = null, sql = null
    //parameter perubahan data
    let param = { id_mobil : req.body.id_mobil }

    if (!req.file) {
        //jika tidak ada file yang dikirim maka update data saja
        data = {
            nomor_mobil : req.body.nomor_mobil,
            merk : req.body.merk,
            jenis : req.body.jenis,
            warna : req.body.warna,
            tahun_pembuatan : req.body.tahun_pembuatan,
            biaya_sewa_per_hari : req.body.biaya_sewa_per_hari
        }
    } else {
        //jika mengirim file maka update data dan reupload
        data = {
            nomor_mobil : req.body.nomor_mobil,
            merk : req.body.merk,
            jenis : req.body.jenis,
            warna : req.body.warna,
            tahun_pembuatan : req.body.tahun_pembuatan,
            biaya_sewa_per_hari : req.body.biaya_sewa_per_hari,
            image : req.file.filename
        }

        //get data yang akan dipudate untuk mendapatkan nama file yang lama
        sql = " select * from mobil where ?"
        //run query
        db.query(sql, param, (err, result) => {
            if (err) throw err
            //tampung nama file yang lama
            let fileName = result[0].image

            //hapus file yang lama
            let dir = path.join(__dirname,"image",fileName)
            fs.unlink(dir, (error) => {})
        })
    }

    //create sql update
    sql = "update mobil set ? where ?"

    //run sql update
    db.query(sql, [data, param], (error, result) => {
        if (error) {
            res.json({
                message: error.message
            })
        } else {
            res.json({
                message: result.affectedRows + " data berhasil diubah"
            })
        }
    })
})


//endpoint menghapus data mobil berdasarkan id_mobil
app.delete("/mobil/:id_mobil", validateToken(), (req,res) => {
    let param = {id_mobil: req.params.id_mobil}

    // ambil data yang akan dihapus
    let sql = "select * from mobil where ?"
    // run query
    db.query(sql, param, (error, result) => {
        if (error) throw error
        
        // tampung nama file yang lama
        let fileName = result[0].image

        // hapus file yg lama
        let dir = path.join(__dirname,"image",fileName)
        fs.unlink(dir, (error) => {})
    })

    // create sql delete
    sql = "delete from mobil where ?"

    // run query
    db.query(sql, param, (error, result) => {
        if (error) {
            res.json({
                message: error.message
            })
        } else {
            res.json({
                message: result.affectedRows + " data berhasil dihapus"
            })
        }      
    })
})

//TABEL PELANGGAN
//endpoint akses data pelanggan
app.get("/pelanggan", validateToken(), (req, res) => {
    //create sql query
    let sql = "select * from pelanggan"

    //run query
    db.query(sql, (error, result) => {
        let response = null
        if (error) {
            response = {
                message : error.message //pesan error
            }
        } else {
            response = {
                count : result.length, //jumlah data
                pelanggan : result //isi data
            }
        }

        res.json(response) //send response
    })
})

//endpoint akses data pelanggan berdasarkan id_pelanggan tertentu
app.get("/pelanggan/:id_pelanggan", validateToken(), (req, res) => {
    let data = {
        id_pelanggan : req.params.id_pelanggan
    }

    //create sql query
    let sql = "select * from pelanggan where ?"

    //run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message : error.message //pesan error
            }
        } else {
            response = {
                count : result.length, //jumlah data
                pelanggan : result //isi data
            }
        }

        res.json(response) //send response
    })
})

//endpoint menyimpan data pelanggan
app.post("/pelanggan", validateToken(), (req, res) => {
    //prepare data
    let data = {
        id_pelanggan : req.body.id_pelanggan,
        nama_pelanggan : req.body.nama_pelanggan,
        alamat_pelanggan : req.body.alamat_pelanggan,
        kontak : req.body.kontak 
    }

    //create sql insert 
    let sql = "insert into pelanggan set ?"

    //run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message : error.message 
            }
        } else {
            response = {
                message : result.affectedRows + " data inserted"
            }
        }

        res.json(response) //send response
    })
})

//endpoint mengubah data pelanggan
app.put("/pelanggan/:id", validateToken(), (req, res) => {
    //prepare data
    let data = [
        //data
        {
            nama_pelanggan : req.body.nama_pelanggan,
            alamat_pelanggan : req.body.alamat_pelanggan,
            kontak : req.body.kontak
        },

        //parameter (primary key)
        {
            id_pelanggan : req.body.id_pelanggan
        }
    ]

    //create sql query update
    let sql = "update pelanggan set ? where ?"

    //run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message : error.message 
            }
        } else {
            response = {
                message : result.affectedRows + " data updated"
            }
        }

        res.json(response) //send response
    })
})

//endpoint menghapus data pelanggan berdasarkan id_pelanggan
app.delete("/pelanggan/:id_pelanggan", validateToken(), (req, res) => {
    //prepare data
    let data = {
        id_pelanggan : req.params.id_pelanggan
    }

    //create query sql delete
    let sql = "delete from pelanggan where ?"

    //run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message : error.message 
            }
        } else {
            response = {
                message : result.affectedRows + " data deleted"
            }
        }

        res.json(response) //send response
    })
})

//TABEL KARYAWAN
//endpoint akses data karyawan
app.get("/karyawan", validateToken(), (req, res) => {
    //create sql query
    let sql = "select * from karyawan"

    //run query
    db.query(sql, (error, result) => {
        let response = null
        if (error) {
            response = {
                message : error.message //pesan error
            }
        } else {
            response = {
                count : result.length, //jumlah data
                karyawan : result //isi data
            }
        }

        res.json(response) //send response
    })
})

//endpoint akses data karyawan berdasarkan id_karyawan tertentu
app.get("/karyawan/:id_karyawan", validateToken(), (req, res) => {
    let data = {
        id_karyawan : req.params.id_karyawan
    }

    //create sql query
    let sql = "select * from karyawan where ?"

    //run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message : error.message //pesan error
            }
        } else {
            response = {
                count : result.length, //jumlah data
                karyawan : result //isi data
            }
        }

        res.json(response) //send response
    })
})

//endpoint menyimpan data karyawan
app.post("/karyawan", validateToken(), (req, res) => {
    //prepare data
    let data = {
        id_karyawan : req.body.id_karyawan,
        nama_karyawan : req.body.nama_karyawan,
        alamat_karyawan : req.body.alamat_karyawan,
        kontak : req.body.kontak,
        username : req.body.username,
        password : md5(req.body.password)
    }

    //create sql insert 
    let sql = "insert into karyawan set ?"

    //run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message : error.message 
            }
        } else {
            response = {
                message : result.affectedRows + " data inserted"
            }
        }

        res.json(response) //send response
    })
})

//endpoint mengubah data karyawan
app.put("/karyawan/:id_karyawan", validateToken(), (req, res) => {
    //prepare data
    let data = [
        //data
        {
            nama_karyawan : req.body.nama_karyawan,
            alamat_karyawan : req.body.alamat_karyawan,
            kontak : req.body.kontak,
            username : req.body.username,
            password : req.body.password
        },

        //parameter (primary key)
        {
            id_karyawan : req.body.id_karyawan
        }
    ]

    //create sql query update
    let sql = "update karyawan set ? where ?"

    //run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message : error.message 
            }
        } else {
            response = {
                message : result.affectedRows + " data updated"
            }
        }

        res.json(response) //send response
    })
})

//endpoint menghapus data karyawan berdasarkan id_karyawan
app.delete("/karyawan/:id_karyawan", validateToken(), (req, res) => {
    //prepare data
    let data = {
        id_karyawan : req.params.id_karyawan
    }

    //create query sql delete
    let sql = "delete from karyawan where ?"

    //run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message : error.message 
            }
        } else {
            response = {
                message : result.affectedRows + " data deleted"
            }
        }

        res.json(response) //send response
    })
})

//TABEL SEWA
// end-point menambahkan data sewa 
app.post("/sewa", validateToken(), (req,res) => {
    let data = {
        id_sewa: req.body.id_sewa,
        id_mobil: req.body.id_mobil,
        id_karyawan: req.body.id_karyawan,
        id_pelanggan: req.body.id_pelanggan,
        tgl_sewa: moment().format('YYYY-MM-DD HH:mm:ss'),
        tgl_kembali: req.body.tgl_kembali,
        total_bayar: req.body.total_bayar
    }

    let sql = "insert into sewa set ?"

    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: " data sewa berhasil ditambahkan"
            }
        }
        res.json(response)
    })
})

// end-point akses data sewa 
app.get("/sewa", validateToken(), (req,res) => {
    let sql = 
    "select s.id_sewa, m.id_mobil, m.nomor_mobil, m.merk, m.jenis, m.warna, k.id_karyawan, k.nama_karyawan, p.id_pelanggan, p.nama_pelanggan, s.tgl_sewa, s.tgl_kembali, s.total_bayar " + 
    "from sewa s join mobil m on s.id_mobil = m.id_mobil " + 
    "join karyawan k on s.id_karyawan = k.id_karyawan " + 
    "join pelanggan p on s.id_pelanggan = p.id_pelanggan"

    db.query(sql, (error, result) => {
        if (error) {
            res.json({ message: error.message})   
        }else{
            res.json({
                count: result.length,
                sewa: result
            })
        }
    })
})

// end-point akses data sewa berdasarkan id
app.get("/sewa/:id_sewa", validateToken(), (req,res) => {
    let param = { id_sewa: req.params.id_sewa}

    let sql =
    "select s.id_sewa, m.id_mobil, m.nomor_mobil, m.merk, m.jenis, m.warna, k.id_karyawan, k.nama_karyawan, p.id_pelanggan, p.nama_pelanggan, s.tgl_sewa, s.tgl_kembali, s.total_bayar " +
    "from sewa s join mobil m on s.id_mobil = m.id_mobil " + 
    "join karyawan k on s.id_karyawan = k.id_karyawan " + 
    "join pelanggan p on s.id_pelanggan = p.id_pelanggan " +
    "where ?"

    db.query(sql, param, (error, result) => {
        if (error) {
            res.json({ message: error.message})   
        }else{
            res.json({
                count: result.length,
                sewa: result
            })
        }
    })
})

//end-point mengubah data sewa
app.put("/sewa", validateToken(), (req,res) => {

    let data = [
        {
            id_mobil: req.body.id_mobil,
            id_karyawan: req.body.id_karyawan,
            id_pelanggan: req.body.id_pelanggan,
            tgl_kembali: req.body.tgl_kembali,
            total_bayar: req.body.total_bayar
        },

        {
            id_sewa: req.body.id_sewa
        }
    ]
    let sql = "update sewa set ? where ?"

    // run query
    db.query(sql, data, (error, result) => {
        let response = null
        if (error) {
            response = {
                message: error.message
            }
        } else {
            response = {
                message: result.affectedRows + " Data sewa berhasil dirubah"
            }
        }
        res.json(response) // send response
    })
})

// end-point menghapus data sewa
app.delete("/sewa/:id_sewa", validateToken(), (req, res) => {
    let param = { id_sewa: req.params.id_sewa}

    let sql = "delete from sewa where ?"

    db.query(sql, param, (error, result) => {
        if (error) {
            res.json({ message: error.message})
        } else {
            res.json({message: "Data sewa berhasil dihapus "})
        }
    })
})

app.listen(7000, () => {
    console.log("Run on port 7000")
})