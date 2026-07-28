import { JSONSchema4 } from 'json-schema';
import { isDefined } from './is-defined';

/**
 * Returns the nested object property definition when any of its child properties match the filter.
 * If the container's own key or title matches the filter, the full unfiltered definition is returned.
 */
function getFilteredObjectProperty(
  definition: JSONSchema4,
  filter: string,
  property: string,
  model?: Record<string, unknown>,
): JSONSchema4 | undefined {
  if (
    property.toLowerCase().includes(filter) ||
    (definition.title as string | undefined)?.toLowerCase().includes(filter)
  ) {
    return definition;
  }

  const nestedModel = (model?.[property] ?? {}) as Record<string, unknown>;
  const subFilteredSchema = getFilteredProperties(definition['properties'], filter, undefined, nestedModel);

  return subFilteredSchema && Object.keys(subFilteredSchema).length > 0
    ? { ...definition, properties: subFilteredSchema }
    : undefined;
}

/**
 * Returns the array property definition when its item schema or any item value matches the filter.
 * If the container's own key or title matches the filter, the full unfiltered definition is returned.
 */
function getFilteredArrayProperty(
  definition: JSONSchema4,
  filter: string,
  property: string,
  model?: Record<string, unknown>,
): JSONSchema4 | undefined {
  if (
    property.toLowerCase().includes(filter) ||
    (definition.title as string | undefined)?.toLowerCase().includes(filter)
  ) {
    return definition;
  }

  const itemsProperties = (definition.items as JSONSchema4).properties;
  const schemaMatch = getFilteredProperties(itemsProperties, filter);
  const schemaMatched = schemaMatch && Object.keys(schemaMatch).length > 0;
  const modelValue = model?.[property];
  const valueMatched =
    !schemaMatched &&
    Array.isArray(modelValue) &&
    modelValue.some((item) => {
      const itemModel = (item ?? {}) as Record<string, unknown>;
      const sub = getFilteredProperties(itemsProperties, filter, undefined, itemModel);
      return sub && Object.keys(sub).length > 0;
    });

  return schemaMatched || valueMatched ? definition : undefined;
}

/**
 * Extracts the schema recursively containing only the filtered properties.
 *
 * A property is included if any of the following match:
 * - The property key name contains the filter
 * - The schema `title` label contains the filter
 * - The current runtime value (from `model`) contains the filter
 *
 * Object properties are delegated to `getFilteredObjectProperty()` and array
 * properties with nested item `properties` are delegated to
 * `getFilteredArrayProperty()`.
 */
export function getFilteredProperties(
  properties: JSONSchema4['properties'],
  filter: string,
  omitFields?: string[],
  model?: Record<string, unknown>,
): JSONSchema4['properties'] {
  if (!isDefined(properties)) return {};
  if (filter.length === 0) {
    if (!omitFields?.length) return properties;

    return Object.fromEntries(Object.entries(properties).filter(([property]) => !omitFields.includes(property)));
  }

  const filteredFormSchema = Object.entries(properties).reduce(
    (acc, [property, definition]) => {
      if (!omitFields?.includes(property)) {
        if (definition['type'] === 'object' && 'properties' in definition) {
          const filteredObjectProperty = getFilteredObjectProperty(definition, filter, property, model);
          if (filteredObjectProperty) {
            acc![property] = filteredObjectProperty;
          }
        } else if (definition['type'] === 'array' && isDefined((definition.items as JSONSchema4)?.properties)) {
          const filteredArrayProperty = getFilteredArrayProperty(definition, filter, property, model);
          if (filteredArrayProperty) {
            acc![property] = filteredArrayProperty;
          }
        } else if (
          property.toLowerCase().includes(filter) ||
          (definition.title as string | undefined)?.toLowerCase().includes(filter) ||
          (() => {
            const val = model?.[property];
            if (typeof val !== 'string' && typeof val !== 'number' && typeof val !== 'boolean') return false;
            return String(val).toLowerCase().includes(filter);
          })()
        ) {
          acc![property] = definition;
        }
      }

      return acc;
    },
    {} as JSONSchema4['properties'],
  );

  return filteredFormSchema;
}
