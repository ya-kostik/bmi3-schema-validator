const typesMap = new Map([
  [ String,    'a String'     ],
  [ Number,    'a Number'     ],
  [ Boolean,   'a Boolean'    ],
  [ Date,      'a Date'       ],
  [ undefined, 'an undefined' ],
  [ null,      'a null'       ],
  [ Object,    'an Object'    ],
  [ Array,     'an Array'     ],
  [ NaN,       'a NaN'        ],
  [ Function,  'a Function'   ]
]);

/**
 * Валидирует данные по схеме
 * @class Validator
 * @prop {Object}  schema схема объекта
 * @prop {Map}     types  типы, доступные для схем
 * @prop {Boolean} strict режим проверки. Если true, будут проверяться только собственные поля объекта, если false, то будут проверяться поля и в прототипах. По-умолчанию false
 *
 */
class Validator {
  constructor(schema, strict = false, def = false) {
    this.schema = schema;
    this.types = typesMap;
    this.strict = strict;
    this.default = def;
  }

  getInvalidPropertyError(key, add = '') {
    return new TypeError(`Invalid property ${key};${add}`)
  }

  /**
   * Поле — тип, или что-то сложнее?
   * @param  {Mixed}  property  поле
   * @return {Boolean}          результат проверки типа. Будет true, если тип один из спика, или если он валидатор, или если он конструктор
   */
  isType(property) {
    return this.types.has(property) || (typeof property === 'function');
  }

  getTypeName(property) {
    const name = this.types.get(property);
    if (name) return name;
    return property.name;
  }

  /**
   * Определяет, является узел схемы плоским или нет
   * @param  {Mixed}  property  узел для провеки
   * @return {Boolean}          да или нет
   */
  isFlat(property, recursive = false) {
    if (this.isType(property)) {
      return {
        required: false,
        requiredInclude: null,
        requiredExclude: null,
        type: property,
        enum: null,
        include: null,
        exclude: null
      };
    }
    if (property.hasOwnProperty('type') && this.isType(property.type)) {
      const flat = {
        type: property.type,
        required: !!property.required,
        requiredInclude: property.requiredInclude || null,
        requiredExclude: property.requiredExclude || null,
        enum: property.enum || null,
        include: property.include || null,
        exclude: property.exclude || null
      }
      if (property.hasOwnProperty('default')) {
        flat.default = property.default
      }
      return flat;
    }
    if (Array.isArray(property)) {
      // Возможно потом стоит добавить isFlatSync и async
      if (recursive) return true;
      return this.isFlat(property[0], true);
    }
    return false;
  }

  /**
   * Проверяет нужно ли сделать поле обязательным по некоторым критериям
   * @param  {Array|null} array        массив элементов для && проверки
   * @param  {Function}   strictFn     критерий проверки для strict режима
   * @param  {Function}   nonStrinctFn критерий проверки для не strict режима
   * @return {Boolean}                 результат проверки
   */
  preRequired(array, strictFn, nonStrinctFn) {
    if (Array.isArray(array)) {
      let preRequired = true;
      for (const key of array) {
        if (this.strict) {
          if (strictFn(key)) {
            preRequired = preRequired && true;
          }
          else {
           preRequired = false;
           break;
          }
        } else {
          if (nonStrinctFn(key)) {
            preRequired = preRequired && true;
          }
          else {
            preRequired = false;
            break;
          }
        }
      }
      return preRequired;
    }
    return false;
  }

  /**
   * Проверить, сделать ли свойство обязательным,
   * если отсутствуют некоторые поля
   * @param  {Array|null}  requiredExclude массив полей
   * @param  {Object}      level           уровень дерева объекта для которого проводится проверка
   * @return {Boolean}                     результат проверки
   */
  isRequiredExclude(requiredExclude, level) {
    return this.preRequired(requiredExclude, (key) => {
      return !level.hasOwnProperty(key);
    }, (key) => {
      return !(key in level);
    });
  }

  /**
   * Проверить, сделать ли свойство обязательным,
   * если присутствуют некоторые поля
   * @param  {Array|null}  requiredInclude массив полей
   * @param  {Object}      level           уровень дерева объекта для которого проводится проверка
   * @return {Boolean}                     результат проверки
   */
  isRequiredInclude(requiredInclude, level) {
    return this.preRequired(requiredInclude, (key) => {
      return level.hasOwnProperty(key);
    }, (key) => {
      return (key in level);
    });
  }

  /**
   * Проверить поле и его валидность на данном уровне дерева объекта
   * @param  {Mixed}  value    значение которое проверяем
   * @param  {Object} level    уровень дерева
   * @param  {Object} options  опции проверки полученные из this.isFLat
   * @return {Boolean}         результат проверки
   */
  isValid(value, level, options) {
    const { requiredInclude, requiredExclude, type } = options;
    let required = options.required;
    let isRequiredInclude = this.isRequiredInclude(requiredInclude, level);
    if (isRequiredInclude) required = isRequiredInclude;
    let isRequiredExclude = this.isRequiredExclude(requiredExclude, level);
    if (isRequiredExclude) required = isRequiredExclude;
    if (required) {
      if (type !== null && type !== undefined) {
        if (!(value || value === 0)) return false;
      }
    } else if (value === undefined) {
      if (this.default && options.hasOwnProperty('default')) {
        // Это хак, дальше в коде на основе этого мы зададим default в свойство
        return false;
      }
      return true;
    }
    if (Array.isArray(options.exclude)) {
      for (const ex of options.exclude) {
        if (this.strict) {
          if (level.hasOwnProperty(ex)) return false;
        } else {
          if (ex in level) return false;
        }
      }
    }
    if (Array.isArray(options.include)) {
      for (const inc of options.include) {
        if (this.strict) {
          if (!level.hasOwnProperty(inc)) return false;
        } else {
          if (!(inc in level)) return false;
        }
      }
    }
    // Если попали в enum проверка типов проводиться будет только в самом enum
    if (Array.isArray(options.enum)) {
      if (options.enum.indexOf(value) === -1) return false;
      else return true;
    }
    if (type === undefined) return value === undefined;
    if (type === null)      return value === null;
    if (type === String)    return typeof value === 'string';
    if (type === Number)    return typeof value === 'number';
    if (type === Boolean)   return typeof value === 'boolean';
    if (type === Function)  return typeof value === 'function';
    if (type === Date)      return value instanceof Date;
    if (type === Object)    return value instanceof Object;
    if (type === Array)     return Array.isArray(value);
    if (typeof type === 'function') {
      if (type.isValidator) {
        return type(value, level, options);
      }
      return value instanceof type;
    }
    // Такие правила
    if (isNaN(type))        return typeof value !== 'number';
    return false;
  }

  /**
   * Проверить валидны ли данные в плоском массиве
   * @param  {Mixed}   value  массив или не массив
   * @param  {Object}  flat   результат метода isFlat
   * @return {Boolean}        валидны данные в массиве или нет
   */
  isValidFlatSchemaArray(value, flat) {
    if (!Array.isArray(value)) {
      return false;
    } else {
      let isValid = true;
      for (const subvalue of value) {
        isValid = isValid && this.isValid(subvalue, {}, flat);
      }
      return isValid;
    }
  }

  /**
   * Проверить плоские, не вложенные переменные
   * @param  {Object} level  объект данных текущего уровня, на котором мы проверяем
   * @param  {String} key    ключ который проверяем
   * @param  {Object} schema схема или ее часть — текущий уровень
   * @param  {Number} dept   на какую глубину мы опустились
   * @param  {String} path   текущий путь внутри объекта в строковом формате
   * @param  {Array} buffer  массив уже собранных ошибок
   * @return {Boolean}       плоский (простой, без вложенностей) узел или нет
   */
  checkFlat(level, key, schema, dept, path, buffer) {
    const value = level[key];
    let flat = this.isFlat(schema);
    if (!flat) return false;
    let isValid;
    if (Array.isArray(schema)) {
      isValid = this.isValidFlatSchemaArray(value, flat);
    } else {
      isValid = this.isValid(value, level, flat);
    }
    if (this.default && !isValid && flat.hasOwnProperty('default')) {
      if (typeof flat.default === 'function') {
        level[key] = flat.default();
      } else {
        level[key] = flat.default;
      }
      isValid = true;
    }
    if (!isValid) {
      const isInclude = (flat.include ? ` Required properties: ${flat.include.join(', ')};` : ``);
      const isExclude = (flat.exclude ? ` Excludes properties: ${flat.exclude.join(', ')};` : ``);
      const isEnum = (flat.enum ? ` Property is enumerable [${flat.enum.join(', ')}];` : ``);
      let isRequired = (flat.required ? ` Property is required; Type of property should be ${this.getTypeName(flat.type)};` : ` Type of property should be ${this.getTypeName(flat.type)};`);
      if (Array.isArray(schema)) {
        isRequired = (flat.required ? ` Property is required; Type of property should be an Array of ${this.getTypeName(flat.type)};` : ` Type of property should be an Array of ${this.getTypeName(flat.type)};`);
      }
      const isRequiredInclude = (flat.requiredExclude ? ` Property is required if object level include ${flat.requiredInclude}` : ``);
      const isRequiredExclude = (flat.requiredExclude ? ` Property is required if object level exclude ${flat.requiredExclude}` : ``);
      buffer.push(this.getInvalidPropertyError(
        dept ? `${path}.${key}` : `${key}`, isRequired + isRequiredInclude + isRequiredExclude + isEnum + isInclude + isExclude
      ));
    }
    return true;
  }

  /**
   * Проверить данные синхронно
   * @param  {Object} level       объект данных текущего уровня, на котором мы проверяем
   * @param  {Object} schema      схема или ее часть — текущий уровень
   * @param  {Number} [dept=0]    на какую глубину мы опустились в объекте
   * @param  {String} [path='']   текущий путь внутри объекта в строковом формате
   * @param  {Array}  [buffer=[]] массив уже найденных ошибок
   * @return {undefined|Array}    undefined, если не найдено ошибок и buffer — массив уже найденных ошибок, если нашли
   */
  validateSync(level, schema, dept = 0, path = '', buffer = []) {
    if (!schema) schema = this.schema;
    const keys = Object.keys(schema);
    for (const key of keys) {
      const schemaProp = schema[key];
      if (!this.checkFlat(level, key, schemaProp, dept, path, buffer)) {
        if (!level[key]) {
          buffer.push(this.getInvalidPropertyError(
            dept ? `${path}.${key}` : `${key}`, ` Property is not defined;`
          ));
        } else {
          if (Array.isArray(schemaProp)) {
            if (!Array.isArray(level[key])) {
              buffer.push(this.getInvalidPropertyError(
                dept ? `${path}.${key}` : `${key}`, ` Property is not an Array;`
              ));
              continue;
            }
            if (!schemaProp[0]) continue;
            for (const sublevel of level[key]) {
              this.validateSync(
                sublevel, schemaProp[0],
                dept + 1, dept ? `${path}.${key}` : `${key}`,
                buffer
              );
            }
          } else {
            this.validateSync(
              level[key], schemaProp,
              dept + 1, dept ? `${path}.${key}` : `${key}`,
              buffer
            );
          }
        }
      }
    }
    return buffer.length ? buffer : undefined;
  }

  /**
   * Проверить данные асинхронно
   * @param  {Object} level       объект данных текущего уровня, на котором мы проверяем
   * @param  {Object} schema      схема или ее часть — текущий уровень
   * @param  {Number} [dept=0]    на какую глубину мы опустились в объекте
   * @param  {String} [path='']   текущий путь внутри объекта в строковом формате
   * @param  {Array}  [buffer=[]] массив уже найденных ошибок
   * @return {undefined|Array}    undefined, если не найдено ошибок и buffer — массив уже найденных ошибок, если нашли
   */
  async validate(level, schema, dept = 0, path = '', buffer = []) {
    if (!schema) schema = this.schema;
    const keys = Object.keys(schema);
    for (const key of keys) {
      const schemaProp = schema[key];
      if (!this.checkFlat(level, key, schemaProp, dept, path, buffer)) {
        if (!level[key]) {
          buffer.push(this.getInvalidPropertyError(
            dept ? `${path}.${key}` : `${key}`, ` Property is not defined;`
          ));
        } else {
          if (Array.isArray(schemaProp)) {
            if (!Array.isArray(level[key])) {
              buffer.push(this.getInvalidPropertyError(
                dept ? `${path}.${key}` : `${key}`, ` Property is not an Array;`
              ));
              continue;
            }
            if (!schemaProp[0]) continue;
            for (const sublevel of level[key]) {
              await new Promise((resolve) => process.nextTick(resolve));
              await this.validate(
                sublevel, schemaProp[0],
                dept + 1, dept ? `${path}.${key}` : `${key}`,
                buffer
              );
            }
          } else {
            await new Promise((resolve) => process.nextTick(resolve));
            await this.validate(
              level[key], schemaProp,
              dept + 1, dept ? `${path}.${key}` : `${key}`,
              buffer
            );
          }
        }
      }
    }
    return buffer.length ? buffer : undefined;
  }
}

module.exports = Validator;
