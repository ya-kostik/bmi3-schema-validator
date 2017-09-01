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

const defaultSchema = {
  name: {
    type: String,
    default: 'Петя'
  },
  card: {
    type: Number,
    default: 12345,
    required: true
  },
  date: {
    type: Date,
    default: Date
  }
}

test('Валиданя с default', () => {
  const validator = new Validator(defaultSchema, false, true);
  const data = {
    card: 1
  }
  validator.validateSync(data);
  expect(data).toEqual({
    name: 'Петя',
    card: 1,
    date: Date()
  });
});

test('Валиданя с default', () => {
  const validator = new Validator(defaultSchema, false, true);
  const data = {}
  validator.validateSync(data);
  expect(data).toEqual({
    name: 'Петя',
    card: 12345,
    date: Date()
  });
});

test('Валидная схема c типом-классом', () => {
  function A() { this.hello = 'world' }
  const validator = new Validator({
    a: {
      required: true,
      type: A
    }
  });
  expect(validator.validateSync({ a: new A() })).toBe(undefined);
});

test('Валидная схема c типом-функцией', () => {
  function A(prop) { this.hello = prop || 'world' }
  function B(value) {
    return value && value.hello === 'world'
  }
  B.isValidator = true;
  const validator = new Validator({
    a: {
      required: true,
      type: B
    },
    b: {
      required: true,
      type: NaN
    }
  });
  expect(validator.validateSync({ a: new A(), b: 'Привет' })).toBe(undefined);
});
