/*global test expect */
const Validator = require('../');

const cardSchema = {
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
    age: {
      type: Number,
      exclude: ['dateOfBirth']
    },
    gender: {
      type: String,
      enum: ['male', 'female']
    },
    dateOfBirth: {
      type: Date,
      exclude: ['age']
    }
  }
}

test('Валидная схема и валидные данные = undefined', () => {
  const validator = new Validator(cardSchema);
  expect(validator.validateSync({
    title: 'Бот для заказа ботов',
    description: 'Еще один бот',
    tags: [],
    client: {
      name: 'Петров',
      gender: 'male'
    }
  })).toBe(undefined);
});

test('Валидная схема и невалидные данные = массив ошибок', () => {
  const validator = new Validator(cardSchema);
  expect(validator.validateSync({
    description: 123,
    tags: [],
    client: {
      name: 'Петров',
      gender: 'children'
    }
  })).toEqual([
    new TypeError('Invalid property title; Property is required; Type of property should be a String;'),
    new TypeError('Invalid property description; Type of property should be a String;'),
    new TypeError('Invalid property client.gender; Type of property should be a String; Property is enumerable [male, female];')
  ])
});