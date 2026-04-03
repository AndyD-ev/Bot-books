require("dotenv").config(); //lee ardhivo .env y carga variables (token, ID, etc)
//herramientas:
const express = require("express"); //para las rutas y crearAPI

const { Client } = require("@notionhq/client");//para conectar con Notion API

const app = express(); //servidor 
app.use(express.json()); //recibir json en el body de las peticiones

const notion = new Client({  //"Hey Nption, este soy yo, aquí esta mi token"
  auth: process.env.NOTION_TOKEN,
});

// Ruta de prueba  AL INGRESAR AL SERVIDOR APARECERÁ API  FUNCIONANDO 
app.get("/", (req, res) => {
  res.send("API funcionando 🚀");
});

app.get("/libros", async (req, res) => {
  try {
    console.log(" GET/libros");
    const response = await notion.databases.query({
  database_id: process.env.DATABASE_ID
});

    console.log("Libros obtenidos:");


    res.json(response.results);

  } catch (error) {
    console.error("ERROR GET:");
    console.error(error.message);
    res.status(500).json({ error: "Error al obtener libros" });
  }
});



// Crear libro --creación de un ENDPOINT  Enviar datos desde telegram/postman
app.post("/libros", async (req, res) => {
  try {
    console.log("📥 POST /libros");
    console.log("BODY:", req.body);


    //LOS NOMBRES LOS DEFINIMOS NOSOTROS, NO SON DEL NOTION
    const { libro, autor, año, generos, status } = req.body; //req.body es el json que enviamos desde postman/telegram


    const response = await notion.pages.create({ //desde await = a estás creando una fila en BD
      parent: { database_id: process.env.DATABASE_ID }, //Guárdalo en esta BD 
      properties: {
        //"Libro" = nombre en NOTION
        //libro = variable de la API

        "Libro": {
          title: [{ text: { content: libro } }],
        },
        "Autor": {
          rich_text: [{ text: { content: autor } }],
        },
        "Año": {
          select: { name: año },
        },
        "Género": {
          multi_select: (generos || []).map((g) => ({ name: g })),
        },  
        "Status": {
          select: { name: status },
        },
      },
    });

    console.log("Libro creado ");



    res.json({ ok: true, data: response }); //respuesta de OK 

  } catch (error) {   
    console.error("ERROR POST:"); 
    console.error(error.message); //Si algo alla,no se rompe sino devuelve respuesta de error
    res.status(500).json({ error: "Error al crear libro" });
  }
});

// levantar servidor
app.listen(process.env.PORT, () => {
  console.log("Servidor corriendo en puerto " + process.env.PORT);
});