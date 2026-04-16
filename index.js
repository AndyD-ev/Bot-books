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
app.get("/libros/search", async (req, res) => {//ruta GET para obtener un libro por nombre, género, autor,id

  try {//intenta ejecutar código.
    console.log("GET /libros/search");

    const { libro, autor, genero, id_visual} = req.query;//query es el parámetro que enviamos 
    // en la URL (ej: /libros/search?query=LI-1)

  //Creación del filtro para notion
    const filters = [];

    // 📚 filtro por libro
    if (libro) {
      filters.push({
        property: "Libro",
        title: {
          contains: libro  //Busca en el campo libro lo que tenga la palabra del query
        }
      });
    }

    // ✍️ filtro por autor
    if (autor) {
      filters.push({
        property: "Autor",
        rich_text: {
          contains: autor
        }
      });
    }

    // 🎭 filtro por género
    if (genero) {
      filters.push({
        property: "Género",
        multi_select: {
          contains: genero
        }
      });
    }
    if (id_visual) {
      filters.push({
        property: "ID",
        unique_id: {
          equals: parseInt(id_visual.split("-")[1])
        }
      });
    }

    const response = await notion.databases.query({
      database_id: process.env.DATABASE_ID,
      filter: filters.length > 0 ? { and: filters } : undefined
    });

    const libros = response.results.map((page) => {
    const props = page.properties;

      return {
        id_visual: `${props.ID.unique_id.prefix}-${props.ID.unique_id.number}`,
        libro: props.Libro.title[0]?.plain_text,
        autor: props.Autor.rich_text[0]?.plain_text || "Sin autor",
        año: props["Año"].select?.name,
        genero: props["Género"].multi_select?.map(g => g.name) || [],
        status: props.Status.select?.name
      };
    });
    //para que no nos devuelva un array vacío, sino un mensaje más amigable
    res.json({
      ok: true,
      total: libros.length,
      mensaje: `Se encontraron ${libros.length} resultado(s)`,
      data: libros
    });

  } catch (error) {//si algo alla, captura el error 
    console.error("ERROR GET/SEARCH:");
    res.status(500).json({ error: "Error en búsqueda" });
  }
});







// Crear libro --creación de un ENDPOINT  Enviar datos desde telegram/postman
app.post("/libros", async (req, res) => {
  try {
    console.log("📥 POST /libros");
    console.log("BODY:", req.body);


    //LOS NOMBRES LOS DEFINIMOS NOSOTROS, NO SON DEL NOTION
    const { libro, autor, año, generos, status, duplicado } = req.body; //req.body es el json que enviamos desde postman/telegram
      //lo de arriba, son los nombres provenientes del JSON (postma) 
    //console.log("GENEROS:", generos);
//......................
    // 🔥 1. NORMALIZAR (para evitar mayúsculas/minúsculas)
    const libroNormalizado = libro?.toLowerCase().trim();

    // 🔍 2. BUSCAR SI YA EXISTE
    const existe = await notion.databases.query({
      database_id: process.env.DATABASE_ID,
      filter: {
        property: "Libro",
        title: {
          contains: libroNormalizado
        }
      }
    });

    // 🚫 3. VALIDAR DUPLICADO
    if (existe.results.length > 0 && !duplicado) {
      console.log("⚠️ DUPLICADO DETECTADO");

      /*return res.json({
        ok: false,
        duplicado: true,
        mensaje: `El libro "${libro}" ya existe`
      });
    }*/

    return res.json({
    ok: false,
    duplicado: true,
    libro: libro,
    existente: existe.results.map(p => ({
      libro: p.properties.Libro.title[0]?.plain_text,
      autor: p.properties.Autor.rich_text[0]?.plain_text
    }))
  });
    }


//........................

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







//______________________________________________________________________________
//IMPLEMENTACIÓN DE TELEGRAM
//______________________________________________________________________________
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: true
});





const axios = require("axios");
//____________________________________________________________________________
//---------------------------BUSCAR LIBROS------------------------------------
//____________________________________________________________________________
bot.onText(/\/buscar (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const texto = match[1];

  let url = "http://localhost:3000/libros/search?";

  if (texto.startsWith("autor:")) {
    const valor = texto.replace("autor:", "");
    url += `autor=${valor}`;
  } else if (texto.startsWith("genero:")) {
    const valor = texto.replace("genero:", "");
    url += `genero=${valor}`;
  } else if (texto.startsWith("libro:")) {
    const valor = texto.replace("libro:", "");
    url += `libro=${valor}`;
  } else {
    // fallback → busca por libro
    url += `libro=${texto}`;
  }

  try {
    const res = await axios.get(url);
    const libros = res.data.data;

    if (libros.length === 0) {
      return bot.sendMessage(chatId, "No encontré nada 😢");
    }

    let respuesta = "📚 Resultados:\n\n";

    libros.forEach((l) => {
      respuesta += `📚 Libro: ${l.libro}\n`;
      respuesta += `✍️ Autor: ${l.autor || "—"}\n`;
      respuesta += `📅 Año: ${l.año || "—"}\n`;
      respuesta += `🎭 Género: ${l.genero.join(", ") || "—"}\n`;
      respuesta += `📌 Status: ${l.status || "—"}\n`;
      respuesta += `---------------------\n\n`;
    });

    bot.sendMessage(chatId, respuesta);

  } catch (error) {
    bot.sendMessage(chatId, "Error al buscar 😵");
  }
});

//HACER UNO DE  COMBINACIONES
// /buscar autor:rowling genero:fantasia

const pendientes ={};  //creación de una memoria

//____________________________________________________________________________
//---------------------------CREAR LIBROS------------------------------------
//____________________________________________________________________________
// -creación de un ENDPOINT  Enviar datos desde telegram/postman

//CON POSTMAN FUNCIONÓ COMO ANTERIOMENTE Y AHORA, LO NUEVO PARA TELEGRAM ESTA ASÍ:
bot.onText(/\/crear\s+(.+)/, async (msg, match) => { //\s+ “uno o más espacios (los que sean 😈)”
  const chatId = msg.chat.id;
  const texto = match[1];

  

//separa los datos globalmente
  const partes = texto.split(",").map(p => p.trim());

  //Asignar variables
  const [libro, autor, año, genero, status] = partes;

  //Hacer petición a la API para crear el libro
  try {
  const res = await axios.post("http://localhost:3000/libros", {
    libro: libro?.trim(),
    autor: autor?.trim(), //trim quita espacios extra
    año: año?.trim(),
    generos: genero?.split("|").map(g => g.trim()),
    status: status?.trim()
  });
  


  
// 🔥 AQUÍ ESTÁ LA CLAVE
if (!res.data.ok) {
  const existentes = res.data.existente;

  let mensaje = `⚠️ El libro "${libro}" ya existe:\n\n`;


  existentes.forEach(l => {
    mensaje += `📚 ${l.libro} - ${l.autor || "—"}\n`;
  });

  pendientes[chatId] = { libro, autor, año, genero, status };

    mensaje += `\n──────────────\n`;     //PARA AÑADIR MÁS MENSAJES
    mensaje += `¿Deseas agregarlo de todos modos?\n`;
  
  return bot.sendMessage(chatId, mensaje, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Add", callback_data: "SI"},
          { text: "❌ Cancel", callback_data: "NO"}
        ]
      ]
    }
  });
}


// ✅ solo si sí se creó
bot.sendMessage(chatId, `✅ Libro "${libro}" creado correctamente`);

  } catch (error) {
  console.error(error.message);
  bot.sendMessage(chatId, "Error al crear libro 😵");
}
});



bot.on("message", async (msg) => {
  console.log("📩 MENSAJE RECIBIDO:", msg.text);

  const chatId = msg.chat.id;
  const texto = msg.text?.toLowerCase();

  if (!pendientes[chatId]) return;

  if (texto === "si") {
    const data = pendientes[chatId];

    await axios.post("http://localhost:3000/libros", {
      libro: data.libro.trim(),
      autor: data.autor.trim(),
      año: data.año.trim(),
      generos: data.genero.split("|").map(g => g.trim()),
      status: data.status.trim(),
      forzar: true
    });

    bot.sendMessage(chatId, "✅ Añadido nuevamente con éxito");
    delete pendientes[chatId];
  }

  if (texto === "no") {
    bot.sendMessage(chatId, "❌ Operación cancelada");
    delete pendientes[chatId];
  }
});
//HAY QUE CHECAR LO DE ARRIBA
//YA QUE CUANDO QUIERES DUPLICAR NO DEJA
/*
//AGREGUE DE AQUÍ HASTA LPINEEA 519
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const accion = query.data;

  bot.answerCallbackQuery(query.id); // importante

  const data = pendientes[chatId];
  if (!data) return;

  // 👉 SI
  if (accion === "SI") {
    await axios.post("http://localhost:3000/libros", {
      libro: data.libro.trim(),
      autor: data.autor.trim(),
      año: data.año.trim(),
      generos: data.genero.split("|").map(g => g.trim()),
      status: data.status.trim(),
      forzar: true
    });

    bot.sendMessage(chatId, "✅ Añadido aunque esté duplicado");
    delete pendientes[chatId];
  }

  // 👉 NO
  if (accion === "NO") {
    bot.sendMessage(chatId, "❌ Operación cancelada");
    delete pendientes[chatId];
  }
});*/


/*bot.on("message", (msg) => {
  console.log("📩 MENSAJE RECIBIDO:", msg.text);
});*/

// levantar servidor
app.listen(process.env.PORT, () => {
  console.log("Servidor corriendo en puerto " + process.env.PORT);

  /*bot.on("message", (msg) => {
  bot.sendMessage(msg.chat.id, "🔥 ya estoy conectado");
});*/
});