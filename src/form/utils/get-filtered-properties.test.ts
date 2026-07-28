import { JSONSchema4 } from 'json-schema';
import { restSchemaProperties } from '../stubs/rest-schema-properties';
import { getFilteredProperties } from './get-filtered-properties';

describe('getFilteredProperties()', () => {
  it('should return only the filtered properties', () => {
    const filteredSchema = getFilteredProperties(restSchemaProperties, 'des');
    expect(filteredSchema).toMatchSnapshot();
  });

  it('should return only the un-omitted properties', () => {
    const filteredSchema = getFilteredProperties(restSchemaProperties, '', [
      'get',
      'post',
      'put',
      'delete',
      'patch',
      'patch',
    ]);
    expect(filteredSchema).toMatchSnapshot();
  });

  it('should return the original properties reference when the filter is empty and no fields are omitted', () => {
    const properties: JSONSchema4['properties'] = {
      metadata: {
        type: 'object',
        properties: {
          displayName: { type: 'string', title: 'Display Name' },
        },
      },
    };

    const result = getFilteredProperties(properties, '');
    expect(result).toBe(properties);
  });

  it('should shallowly omit fields without recursively rebuilding nested schemas when the filter is empty', () => {
    const properties: JSONSchema4['properties'] = {
      metadata: {
        type: 'object',
        properties: {
          displayName: { type: 'string', title: 'Display Name' },
        },
      },
      description: { type: 'string', title: 'Description' },
    };

    const result = getFilteredProperties(properties, '', ['description']);
    expect(result).toEqual({ metadata: properties.metadata });
    expect(result?.metadata).toBe(properties.metadata);
  });

  it('should match a property by its schema title when the key does not match', () => {
    const properties: JSONSchema4['properties'] = {
      icon: {
        type: 'string',
        title: 'Kamelet Icon',
        description: 'The icon',
      },
      name: {
        type: 'string',
        title: 'Name',
        description: 'The name',
      },
    };

    const result = getFilteredProperties(properties, 'kamelet');
    expect(Object.keys(result!)).toEqual(['icon']);
  });

  it('should match a property by its current runtime value', () => {
    const properties: JSONSchema4['properties'] = {
      timerName: { type: 'string', title: 'Timer Name' },
      period: { type: 'string', title: 'Period' },
    };
    const model = { timerName: 'mySpecialTimer', period: '1000' };

    const result = getFilteredProperties(properties, 'myspecialtimer', undefined, model);
    expect(Object.keys(result!)).toEqual(['timerName']);

    const result2 = getFilteredProperties(properties, '1000', undefined, model);
    expect(Object.keys(result2!)).toEqual(['period']);
  });

  it('should return an empty object when properties is undefined', () => {
    const result = getFilteredProperties(undefined, 'anything');
    expect(result).toEqual({});
  });

  it('should surface a nested object field when a child property matches', () => {
    const properties: JSONSchema4['properties'] = {
      metadata: {
        type: 'object',
        title: 'Metadata',
        properties: {
          displayName: { type: 'string', title: 'Display Name' },
          version: { type: 'string', title: 'Version' },
        },
      },
      unrelated: { type: 'string', title: 'Unrelated' },
    };

    const result = getFilteredProperties(properties, 'display');
    expect(Object.keys(result!)).toEqual(['metadata']);
    expect((result!['metadata'] as JSONSchema4).properties).toEqual({
      displayName: { type: 'string', title: 'Display Name' },
    });

    const noMatch = getFilteredProperties(properties, 'zzz');
    expect(Object.keys(noMatch!)).toHaveLength(0);
  });

  it('should surface an array field when a null item is in the model', () => {
    const properties: JSONSchema4['properties'] = {
      items: {
        type: 'array',
        title: 'Items',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', title: 'Label' },
          },
        },
      },
    };
    const model = { items: [null, { label: 'hello' }] };

    const result = getFilteredProperties(properties, 'hello', undefined, model as Record<string, unknown>);
    expect(Object.keys(result!)).toContain('items');
  });

  it('should surface an array field whose item properties match by schema title', () => {
    const properties: JSONSchema4['properties'] = {
      kameletProperties: {
        type: 'array',
        title: 'Properties',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Property name' },
          },
        },
      },
    };

    const result = getFilteredProperties(properties, 'property');
    expect(Object.keys(result!)).toContain('kameletProperties');
  });

  it('should not surface an array field when no item property matches', () => {
    const properties: JSONSchema4['properties'] = {
      kameletProperties: {
        type: 'array',
        title: 'Properties',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Property name' },
          },
        },
      },
    };

    const result = getFilteredProperties(properties, 'zzz');
    expect(Object.keys(result!)).toHaveLength(0);
  });

  it('should surface an array field when an item sub-property value matches the filter', () => {
    const properties: JSONSchema4['properties'] = {
      kameletProperties: {
        type: 'array',
        title: 'Properties',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Property name' },
            value: { type: 'string', title: 'Value' },
          },
        },
      },
    };
    const model = { kameletProperties: [{ name: 'Test', value: '' }] };

    const result = getFilteredProperties(properties, 'test', undefined, model);
    expect(Object.keys(result!)).toContain('kameletProperties');

    const result2 = getFilteredProperties(properties, 'zzz', undefined, model);
    expect(Object.keys(result2!)).toHaveLength(0);
  });

  it('should match a plain-string array field on its key name', () => {
    const properties: JSONSchema4['properties'] = {
      headers: {
        type: 'array',
        title: 'Headers',
        items: { type: 'string' },
      },
    };

    const result = getFilteredProperties(properties, 'header');
    expect(Object.keys(result!)).toContain('headers');

    const result2 = getFilteredProperties(properties, 'zzz');
    expect(Object.keys(result2!)).toHaveLength(0);
  });

  it('should surface an object field when the container key matches and no child matches', () => {
    const properties: JSONSchema4['properties'] = {
      metadata: {
        type: 'object',
        title: 'Metadata',
        properties: {
          displayName: { type: 'string', title: 'Display Name' },
        },
      },
      unrelated: { type: 'string', title: 'Unrelated' },
    };

    // match by key
    const byKey = getFilteredProperties(properties, 'metadata');
    expect(Object.keys(byKey!)).toEqual(['metadata']);
    expect(byKey!['metadata']).toBe(properties!['metadata']);

    // match by title
    const byTitle = getFilteredProperties(properties, 'metadat');
    expect(Object.keys(byTitle!)).toEqual(['metadata']);

    // no match
    const noMatch = getFilteredProperties(properties, 'zzz');
    expect(Object.keys(noMatch!)).toHaveLength(0);
  });

  it('should surface an array field when the container key matches and no child matches', () => {
    const properties: JSONSchema4['properties'] = {
      kameletProperties: {
        type: 'array',
        title: 'Kamelet Properties',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Name' },
          },
        },
      },
    };

    // match by key
    const byKey = getFilteredProperties(properties, 'kameletproperties');
    expect(Object.keys(byKey!)).toEqual(['kameletProperties']);
    expect(byKey!['kameletProperties']).toBe(properties!['kameletProperties']);

    // match by title
    const byTitle = getFilteredProperties(properties, 'kamelet prop');
    expect(Object.keys(byTitle!)).toEqual(['kameletProperties']);

    // no match
    const noMatch = getFilteredProperties(properties, 'zzz');
    expect(Object.keys(noMatch!)).toHaveLength(0);
  });
});
