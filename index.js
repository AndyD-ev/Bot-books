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


app.get("/libros", async (req, res) => {//ruta GET para obtener libros
  try { //intenta ejecutar código.
    console.log(" GET/libros");
    const response = await notion.databases.query({//Dame todos los registros de esta BD
  database_id: process.env.DATABASE_ID
});
    console.log("Libros obtenidos:");
    //res.json(response.results);//devuelve datos (lo que se ve en postman)
    //SUSTITUIR LO DE ARRIBA POR ESTO PARA QUE SE VEA MEJOR EN 
    //EN POSTMAN, Y SOLO CIERTOS CAMPOS
    const libros = response.results.map((page) => {
    const props = page.properties;

  return {
    //id: page.id, // ID real interno
    id_visual: `${props.ID.unique_id.prefix}-${props.ID.unique_id.number}`, // LI-1

    libro: props.Libro.title[0]?.plain_text,
    autor: props.Autor.rich_text[0]?.plain_text,
    año: props["Año"].select?.name,
    genero: props["Género"].multi_select.map(g => g.name),
    status: props.Status.select?.name
  };
});

res.json(libros);

  } catch (error) { //si algo alla, captura el error
    console.error("ERROR GET:");
    console.error(error.message);
    res.status(500).json({ error: "Error al obtener libros" });//si algo Falla, responde con este error
  }
});




//RUTA ESPECIAL PARA BUSCAR LIBRO 
app.get("/libros/search", async (req, res) => { //ruta GET para obtener un libro por ID
try { //intenta ejecutar código.
  const { query } = req.query; //query es el parámetro que enviamos en la URL (ej: /libros/search?query=LI-1)
    console.log(" GET/libros/search");

  //Creación del filtro para notion
  const response = await notion.databases.query({
  database_id: process.env.DATABASE_ID,
  filter: {
    property: "Libro",
    title: {
      contains: query //Busca en el campo libro lo que tenga la palabra del query
    }
  }
});
  
  console.log("Libros encontrados:");

  const libros = response.results.map((page) => {
  const props = page.properties;

  return {
    id_visual: `${props.ID.unique_id.prefix}-${props.ID.unique_id.number}`, // LI-1
    libro: props.Libro.title[0]?.plain_text,
    autor: props.Autor.rich_text[0]?.plain_text,
    año: props["Año"].select?.name,
    genero: props["Género"].multi_select.map(g => g.name),
    status: props.Status.select?.name
  };
});
  
res.json({
  ok: true,
  total: libros.length,
  mensaje: `Se encontraron ${libros.length} libro(s) para la búsqueda "${query}"`,
  data: libros
});


  } catch (error) { //si algo alla, captura el error
    console.error("ERROR GET/SEARCH:");
    console.error(error.message);
    res.status(500).json({ error: "Error en la búsqueda de libros" });//si algo Falla, responde con este error
  }

});




// Crear libro --creación de un ENDPOINT  Enviar datos desde telegram/postman
app.post("/libros", async (req, res) => {
  try {
    console.log("📥 POST /libros");
    console.log("BODY:", req.body);


    //LOS NOMBRES LOS DEFINIMOS NOSOTROS, NO SON DEL NOTION
    const { libro, autor, año, generos, status } = req.body; //req.body es el json que enviamos desde postman/telegram
      //lo de arriba, son los nombres provenientes del JSON (postma) 
console.log("GENEROS:", generos);
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
    //res.json({ ok: true, data: response }); //respuesta o lo que devuelve postman 
    res.json({
    ok: true,
    id: response.id_visual,
    //id: response.id,
    libro: libro,
    autor: autor,
    mensaje: "Libro creado correctamente"
  });

  } catch (error) {   
    console.error("ERROR POST:"); 
    console.error(error.message); //Si algo alla,no se rompe sino devuelve respuesta de error
    res.status(500).json({ error: "Error al crear libro" });
  }
});




    app.patch("/libros/:id_visual", async (req, res) => {
  try {
    const { id_visual } = req.params;
    const { libro, autor, año, generos, status } = req.body;

    const [prefix, number] = id_visual.split("-");

    // 🔍 buscar libro
    const search = await notion.databases.query({
      database_id: process.env.DATABASE_ID,
      filter: {
        property: "ID",
        unique_id: {
          equals: parseInt(number)
        }
      }
    });

    const page = search.results[0];

    if (!page) {
      return res.status(404).json({ error: "Libro no encontrado" });
    }

    // 🧠 construir propiedades dinámicamente
    const properties = {};

    if (libro) {
      properties["Libro"] = {
        title: [{ text: { content: libro } }]
      };
    }

    if (autor) {
      properties["Autor"] = {
        rich_text: [{ text: { content: autor } }]
      };
    }

    if (año) {
      properties["Año"] = {
        select: { name: año }
      };
    }

    if (generos) {
      properties["Género"] = {
        multi_select: generos.map((g) => ({ name: g }))
      };
    }

    if (status) {
      properties["Status"] = {
        select: { name: status }
      };
    }

    // ✏️ actualizar solo lo necesario
    await notion.pages.update({
      page_id: page.id,
      properties
    });

    res.json({ ok: true, mensaje:  `¡El libro fue actualizado!`}); 

  } catch (error) {
    console.error(error.message); 
    res.status(500).json({ error: "Error al actualizar" });
  }
});















































// levantar servidor
app.listen(process.env.PORT, () => {
  console.log("Servidor corriendo en puerto " + process.env.PORT);
});