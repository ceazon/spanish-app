import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.cwd(), 'src/content/approved-vocab-1000.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const batch = {
  Family: [
    ['Mother','Madre'],['Father','Padre'],['Brother','Hermano'],['Sister','Hermana'],['Son','Hijo'],['Daughter','Hija'],['Grandmother','Abuela'],['Grandfather','Abuelo'],['Uncle','Tío'],['Aunt','Tía']
  ],
  Home: [
    ['House','Casa'],['Room','Habitación'],['Kitchen','Cocina'],['Bathroom','Baño'],['Door','Puerta'],['Window','Ventana'],['Table','Mesa'],['Chair','Silla'],['Bed','Cama'],['Key','Llave']
  ],
  School: [
    ['School','Escuela'],['Teacher','Profesor'],['Student','Estudiante'],['Book','Libro'],['Notebook','Cuaderno'],['Pen','Bolígrafo'],['Pencil','Lápiz'],['Class','Clase'],['Homework','Tarea'],['Exam','Examen']
  ],
  Time: [
    ['Today','Hoy'],['Tomorrow','Mañana'],['Yesterday','Ayer'],['Morning','Mañana'],['Afternoon','Tarde'],['Night','Noche'],['Week','Semana'],['Month','Mes'],['Year','Año'],['Hour','Hora']
  ],
  Weather: [
    ['Sun','Sol'],['Rain','Lluvia'],['Cloud','Nube'],['Wind','Viento'],['Snow','Nieve'],['Hot','Caliente'],['Cold','Frío'],['Warm','Templado'],['Storm','Tormenta'],['Weather','Clima']
  ],
  City: [
    ['Street','Calle'],['City','Ciudad'],['Town','Pueblo'],['Park','Parque'],['Store','Tienda'],['Market','Mercado'],['Bank','Banco'],['Hospital','Hospital'],['Pharmacy','Farmacia'],['Airport','Aeropuerto']
  ],
  Transport: [
    ['Car','Coche'],['Bus','Autobús'],['Train','Tren'],['Bicycle','Bicicleta'],['Plane','Avión'],['Taxi','Taxi'],['Ticket','Boleto'],['Station','Estación'],['Road','Carretera'],['Travel','Viajar']
  ],
  Body: [
    ['Head','Cabeza'],['Eye','Ojo'],['Ear','Oreja'],['Nose','Nariz'],['Mouth','Boca'],['Hand','Mano'],['Arm','Brazo'],['Leg','Pierna'],['Foot','Pie'],['Heart','Corazón']
  ],
  Clothes: [
    ['Shirt','Camisa'],['Pants','Pantalones'],['Shoes','Zapatos'],['Dress','Vestido'],['Jacket','Chaqueta'],['Hat','Sombrero'],['Socks','Calcetines'],['Coat','Abrigo'],['Skirt','Falda'],['Glasses','Gafas']
  ],
  VerbsBasics: [
    ['To be','Ser'],['To have','Tener'],['To go','Ir'],['To come','Venir'],['To eat','Comer'],['To drink','Beber'],['To speak','Hablar'],['To read','Leer'],['To write','Escribir'],['To listen','Escuchar']
  ],
  VerbsDaily: [
    ['To sleep','Dormir'],['To wake up','Despertar'],['To work','Trabajar'],['To study','Estudiar'],['To buy','Comprar'],['To sell','Vender'],['To open','Abrir'],['To close','Cerrar'],['To walk','Caminar'],['To run','Correr']
  ],
  Adjectives: [
    ['Big','Grande'],['Small','Pequeño'],['Fast','Rápido'],['Slow','Lento'],['Easy','Fácil'],['Difficult','Difícil'],['New','Nuevo'],['Old','Viejo'],['Good','Bueno'],['Bad','Malo']
  ],
  Emotions: [
    ['Happy','Feliz'],['Sad','Triste'],['Angry','Enojado'],['Tired','Cansado'],['Excited','Emocionado'],['Calm','Tranquilo'],['Nervous','Nervioso'],['Worried','Preocupado'],['Surprised','Sorprendido'],['Scared','Asustado']
  ],
  Restaurant: [
    ['Menu','Menú'],['Waiter','Mesero'],['Bill','Cuenta'],['Tip','Propina'],['Fork','Tenedor'],['Knife','Cuchillo'],['Spoon','Cuchara'],['Plate','Plato'],['Glass','Vaso'],['Napkin','Servilleta']
  ],
  Fruits: [
    ['Banana','Banana'],['Orange (fruit)','Naranja'],['Grape','Uva'],['Strawberry','Fresa'],['Lemon','Limón'],['Peach','Melocotón'],['Pear','Pera'],['Pineapple','Piña'],['Watermelon','Sandía'],['Mango','Mango']
  ],
  Vegetables: [
    ['Tomato','Tomate'],['Potato','Papa'],['Onion','Cebolla'],['Carrot','Zanahoria'],['Lettuce','Lechuga'],['Corn','Maíz'],['Bean','Frijol'],['Garlic','Ajo'],['Pepper','Pimiento'],['Cucumber','Pepino']
  ],
  Technology: [
    ['Computer','Computadora'],['Phone','Teléfono'],['Internet','Internet'],['Screen','Pantalla'],['Keyboard','Teclado'],['Mouse','Ratón'],['Password','Contraseña'],['Email','Correo electrónico'],['Message','Mensaje'],['Website','Sitio web']
  ],
  Work: [
    ['Office','Oficina'],['Meeting','Reunión'],['Boss','Jefe'],['Coworker','Compañero'],['Project','Proyecto'],['Deadline','Fecha límite'],['Salary','Salario'],['Job','Trabajo'],['Career','Carrera'],['Interview','Entrevista']
  ],
  Nature: [
    ['Mountain','Montaña'],['River','Río'],['Lake','Lago'],['Beach','Playa'],['Forest','Bosque'],['Sea','Mar'],['Sky','Cielo'],['Earth','Tierra'],['Fire','Fuego'],['Air','Aire']
  ],
  Places: [
    ['Restaurant','Restaurante'],['Hotel','Hotel'],['Museum','Museo'],['Library','Biblioteca'],['Church','Iglesia'],['Gym','Gimnasio'],['Cinema','Cine'],['Mall','Centro comercial'],['Neighborhood','Barrio'],['Bridge','Puente']
  ]
};

const existing = data.vocab || {};
for (const [category, pairs] of Object.entries(batch)) {
  const prior = existing[category] || [];
  const seen = new Set(prior.map((x) => `${x.en}::${x.es}`));
  for (const [en, es] of pairs) {
    const key = `${en}::${es}`;
    if (seen.has(key)) continue;
    prior.push({ en, es, difficulty: en.length > 8 ? 2 : 1, approved: true, confidence: 0.98 });
    seen.add(key);
  }
  existing[category] = prior;
}

data.vocab = existing;
data.status = 'phase-2-batch1';
let count = 0;
for (const list of Object.values(existing)) count += list.length;
data.currentCount = count;

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`updated approved vocab count: ${count}`);
