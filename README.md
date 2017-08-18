# bmi3-schema-validator
Простой валидатор объектов по схемам похожим на схемы Mongoose, но независимо от него. Изначально использовался для конструктора ботов Botmother

Если вы заметили ошибку, хотите сделать перевод на английский язык или расширить функционал, не стесняйтесь открывать issue или делать pull request.

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

Когда схема валидна метод `validateSync` вернет `undefined`, а если не валидна то массив с `TypeError` ошибками. По одному для каждой найденной.

Валидатор обходит схему рекурсивно. И по этим причинам для больших схем, особенно с участием массивов, может быть полезен асинхронный метод `validate`. Принцип у него такой же, разница только в том, что `validate` возвращает промис.

## Валидация массивов

Можно валидировать и массивы, правда массив в массиве пока валидировать мы не умеем:

```javascript
const validator = new Validator({
  tags: [{ name: { type: String, required: true }, description: String }]
});

const result = validator.validateSync({
  tags: [{
    name: 'Онлайн-заказ',
    description: 'Отметка для всех ботов с онлайн-заказом'
  }, {
    name: 'Чат'
  }]
});
```

Валидатор переберет все элементы в массиве и сравнит их со схемой.

Массивы могут быть и плоскими:
```javascript
const validator = new Validator({
  tags: [String]
});

validator.validateSync({
  tags: ['Онлайн-заказ', 'Чат', 'Кнопочный']
});
```

Пустой массив считается верным, а вот его отсутствие в проверяемом объекте считается неправильным.

## Типы и модификаторы

Вы можете выбрать один из следующих типов:
```javascript
const typesMap = new Map([
  [ String,    'a String'     ],
  [ Number,    'a Number'     ],
  [ Boolean,   'a Boolean'    ],
  [ Date,      'a Date'       ],
  [ undefined, 'an undefined' ],
  [ null,      'a null'       ],
  [ Object,    'an Object'    ],
  [ Array,     'an Array'     ],
  [ NaN,       'a NaN'        ]
]);
```

Все типы проверяются на соответствие, кроме `NaN`. `NaN` не будет выдавать ошибку для `"123"`, т. е. проверяется что перед нами действительно не число. Строки, которые JavaScript иногда считает числами, `NaN` такими не считает.

Узлы могут быть простыми:
```javascript
{
  // Если есть поле title, оно должно быть строкой
  title: String
}
```
и с модификаторами:
```javascript
{
  category: {
    // Тип у category будет строка
    type: String,
    // Это обязательное поле
    required: true,
    // Только из выбранных
    enum: ['Бот с кнопками', 'Бот-токенизатор', 'Самообучающийся бот'],
    // Если есть категория, обязательно должны быть поля:
    include: ['productCurator'],
    // Если есть категория, не должно быть полей:
    exclude: ['parent'],
    // Категория обязательна, если есть поля:
    requiredInclude: ['owner', 'price'],
    // Категория обязательна, если нет полей:
    requiredExclude: ['subcategory']
  }
}
```
Пример, конечно, синтетический, но он дает представление, какие условия для схемы и поля можно описать.

Важно отметить, что `include`, `exclude`, `requiredInclude`, `requiredExclude` будут искать поля только на том же уровне, что и само поле. Т. е. нельзя написать что-то такое `'owner.name'` или `'../user'`.

## Строгий и нестрогий режимы

Строгий режим будет проверять только собственные свойства объекта, т. е. будет использован метод `data.hasOwnProperty(key)`. Не строгий режим проверяет данные и в прототипах `key in data`. По-умолчанию включен нестрогий режим.

Вы можете задать режим при создании валидатора:
```javascript
const strict = true;
const validator = new Validator(schema, strict);
```
или изменить в процессе выполнения:
```javascript
validator.strict = true;
```

## Расширение валидации

Если вы хотите добавить дополнительную логику в ваш валидатор, можно просто применить простое наследование:
```javascript
class MyValidator extends Validator {
  validateSync(level, schema, depth = 0, path = '', buffer = []) {
    super.validateSync(level, schema, depth, path, buffer);
    if (depth === 0) {
      if (!(Array.isArray(level.buttons) && Array.isArray(level.buttons[0]))) {
        buffer.push(
          getInvalidPropertyError('buttons', ' Buttons should be an Array of Arrays')
        );
      }
    }
    return buffer.length ? buffer : undefined;
  }
}
```

## Лицензия
MIT. Никакие гарантии на библиотеку не распространяются, она предоставляется как есть.
