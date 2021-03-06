jest.dontMock('../StructUtil');
jest.dontMock('../../structs/List');
jest.dontMock('../../structs/Item');

var _ = require('underscore');
var StructUtil = require('../StructUtil');
var List = require('../../structs/List');
var Item = require('../../structs/Item');

describe('StructUtil', function () {
  describe('#copyRawObject', function () {
    var expectedArrayItems = [1, 'foo', null, {foo: 'bar'}, {item: 'struct'}];
    // Turn last item into a struct
    var arrayItems = expectedArrayItems.slice();
    arrayItems.push(new Item(arrayItems.pop()));
    // Create List struct with embedded Item struct
    var listStruct = new List({items: arrayItems});
    // Create Item struct with embedded List Struct
    var itemStruct = new Item({qux: 'foo', items: listStruct});

    it('should return original data if no structs', function () {
      var fn = function () {};
      var originalObject = [1, 'string', fn, true];
      var newObj = StructUtil.copyRawObject(originalObject);
      expect(_.isEqual(newObj, originalObject)).toBeTruthy();
    });

    it('should return original data from List struct', function () {
      var newObj = StructUtil.copyRawObject(listStruct);
      expect(_.isEqual(newObj, expectedArrayItems)).toBeTruthy();
    });

    it('should clone Objects', function () {
      var array = [];
      var object = {};
      expect(StructUtil.copyRawObject(array) !== array).toBeTruthy();
      expect(StructUtil.copyRawObject(object) !== object).toBeTruthy();
    });

    it('should clone Objects with structs', function () {
      var newObj = StructUtil.copyRawObject(itemStruct);
      expect(itemStruct._itemData !== newObj).toBeTruthy();
      expect(newObj.items !== expectedArrayItems).toBeTruthy();
    });

    it('should return original data with nested structs', function () {
      var fn = function () {};
      var nestedObj = {
        foo: listStruct,
        bar: itemStruct,
        foobar: fn
      };
      var newObj = StructUtil.copyRawObject(nestedObj);
      var expectedObj = {
        foo: expectedArrayItems,
        bar: {
          qux: 'foo',
          items: expectedArrayItems
        },
        foobar: fn
      };
      expect(_.isEqual(newObj, expectedObj)).toBeTruthy();
    });

  });
});
