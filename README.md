# bmi3-schema-validator
Простой валидатор объектов по схемам похожим на схемы Mongoose, но независимо от него. Изначально использовался для конструктора ботов Botmother

## Быстрый старт
```javascript
const Validator = require('bmi3-schema-validator');
const validator = new Validator({
  title: {
    required: true,
    type: String
  },
  description: String,
  tags: [{ name: { type: String, required: true }, description: String }],
  client: {
    name: {
      required: true,
      type: String
    },
    age: Number,
    gender: {
      type: String,
      enum: ['male', 'female']
    }
  }
});

const result = validator.validateSync({
  title: 'Бот для заказа ботов',
  description: 'Еще один бот',
  tags: [],
  client: {
    name: 'Петров',
    gender: 'male'
  }
});
if (!result) console.info('Все ок!');
else {
  console.error('У нас проблемы:');
  for (const err of result) {
    console.error(err);
  }
}
```

## Лицензия
MIT. Никакие гарантии на библиотеку не распространяются, она предоставляется как есть.
