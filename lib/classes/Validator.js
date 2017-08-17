const typesMap = new Map([
  [String,    'a String'    ],
  [Number,    'a Number'    ],
  [Boolean,   'a Boolean'   ],
  [Date,      'a Date'      ],
  [undefined, 'an undefined'],
  [null,      'a null'      ],
  [Object,    'an Object'   ],
  [Array,     'an Array'    ],
  [NaN,       'a NaN'       ]
])

/**
 * Валидирует данные по схеме
 * @class Validator
 * @prop {Object}  schema схема объекта
 * @prop {Map}     types  типы, доступные для схем
 * @prop {Boolean} strict режим проверки. Если true, будут проверяться только собственные поля объекта, если false, то будут проверяться поля и в прототипах. По-умолчанию false
 *
 */
class Validator {
  constructor(schema, strict = false) {
    this.schema = schema;
    this.types = typesMap;
    this.strict = strict;
  }

  getInvalidPropertyError(key, add = '') {
    return new TypeError(`Invalid property ${key};${add}`)
  }

  /**
   * Определяет, является узел схемы плоским или нет
   * @param  {Mixed}  property  узел для провеки
   * @return {Boolean}          да или нет
   */
  isFlat(property, recursive = false) {
    if (this.types.has(property)) {
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
    if (property.hasOwnProperty('type') && this.types.has(property.type)) {
      return {
        type: property.type,
        required: !!property.required,
        requiredInclude: property.requiredInclude || null,
        requiredExclude: property.requiredExclude || null,
        enum: property.enum || null,
        include: property.include || null,
        exclude: property.exclude || null
      };
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
    if (type === Date)      return value instanceof Date;
    if (type === Object)    return value instanceof Object;
    if (type === Array)     return Array.isArray(value);
    // Такие правила
    if (isNaN(type))        return typeof value !== 'number';
    return false;
  }

  isValidFlatSchemaArray(value, schema, flat) {
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

  checkFlat(level, key, schema, dept, path, buffer) {
    const value = level[key];
    let flat = this.isFlat(schema);
    if (!flat) return false;
    let isValid;
    if (Array.isArray(schema)) {
      isValid = this.isValidFlatSchemaArray(value, schema[0], flat);
    } else {
      isValid = this.isValid(value, level, flat);
    }
    if (!isValid) {
      const isInclude = (flat.include ? ` Required properties: ${flat.include.join(', ')};` : ``);
      const isExclude = (flat.exclude ? ` Excludes properties: ${flat.exclude.join(', ')};` : ``);
      const isEnum = (flat.enum ? ` Property is enumerable [${flat.enum.join(', ')}];` : ``);
      let isRequired = (flat.required ? ` Property is required; Type of property should be ${this.types.get(flat.type)};` : ` Type of property should be ${this.types.get(flat.type)};`);
      if (Array.isArray(schema)) {
        isRequired = (flat.required ? ` Property is required; Type of property should be an Array of ${this.types.get(flat.type)};` : ` Type of property should be an Array of ${this.types.get(flat.type)};`);
      }
      const isRequiredInclude = (flat.requiredExclude ? ` Property is required if object level include ${flat.requiredInclude}` : ``);
      const isRequiredExclude = (flat.requiredExclude ? ` Property is required if object level exclude ${flat.requiredExclude}` : ``);
      buffer.push(this.getInvalidPropertyError(
        dept ? `${path}.${key}` : `${key}`, isRequired + isRequiredInclude + isRequiredExclude + isEnum + isInclude + isExclude
      ));
    }
    return true;
  }

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