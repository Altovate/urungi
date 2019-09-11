(function () {
    'use strict';

    angular.module('app.reports').factory('pivot', pivot);

    pivot.$inject = ['numeral', 'moment', 'gettextCatalog', 'api', 'layerService'];

    function pivot (numeral, moment, gettextCatalog, api, layerService) {
        const service = {
            createPivotTable: createPivotTable,
        };

        return service;

        function createPivotTable (element, report, rows) {
            return api.getLayer(report.selectedLayerID).then(layer => {
                const layerObjects = layerService.flattenObjects(layer.objects);
                const layerObjectsMap = new Map(layerObjects.map(object => [object.elementID, object]));
                const input = function (callback) {
                    const columns = report.properties.ykeys.concat(report.properties.pivotKeys.columns, report.properties.pivotKeys.rows);
                    for (const row of rows) {
                        const newRow = {};
                        for (const column of columns) {
                            const layerObject = layerObjectsMap.get(column.elementID);
                            const label = column.label || layerObject.elementLabel;
                            newRow[label] = row[column.id];
                        }
                        callback(newRow);
                    }
                };
                const options = getPivotTableOptions(report, layerObjectsMap);
                element.pivot(input, options);
            });
        }

        function getPivotTableOptions (report, layerObjectsMap) {
            const ykey = report.properties.ykeys[0];
            const layerObject = layerObjectsMap.get(ykey.elementID);

            let formatFn = x => x;
            const format = ykey.format || layerObject.format;
            if (format) {
                if (ykey.elementType === 'number') {
                    formatFn = x => numeral(x).format(format);
                } else if (ykey.elementType === 'date' && !ykey.aggregation) {
                    formatFn = x => moment(x).format(format);
                }
            }

            let aggregator;
            const aggregatorTemplates = $.pivotUtilities.aggregatorTemplates;
            switch (ykey.aggregation) {
            case 'count':
                aggregator = aggregatorTemplates.count(formatFn);
                break;
            case 'countDistinct':
                aggregator = aggregatorTemplates.countUnique(formatFn);
                break;
            case 'sum':
                aggregator = aggregatorTemplates.sum(formatFn);
                break;
            case 'avg':
                aggregator = aggregatorTemplates.average(formatFn);
                break;
            case 'min':
                aggregator = aggregatorTemplates.min(formatFn);
                break;
            case 'max':
                aggregator = aggregatorTemplates.max(formatFn);
                break;
            default:
                aggregator = aggregatorTemplates.uniques(x => x[0], formatFn);
            }

            const pivotKeys = report.properties.pivotKeys;
            const cols = pivotKeys.columns.map(e => {
                return e.label || layerObjectsMap.get(e.elementID).elementLabel;
            });
            const rows = pivotKeys.rows.map(e => {
                return e.label || layerObjectsMap.get(e.elementID).elementLabel;
            });

            const options = {
                dataClass: $.pivotUtilities.SubtotalPivotData,
                cols: cols,
                rows: rows,
                aggregator: aggregator([layerObject.elementLabel]),
                renderer: $.pivotUtilities.subtotal_renderers['Table With Subtotal'],
                rendererOptions: {
                    rowSubtotalDisplay: {
                        hideOnExpand: true,
                    },
                    colSubtotalDisplay: {
                        hideOnExpand: true,
                    },
                    collapseColsAt: 0,
                    collapseRowsAt: 0,
                    localeStrings: {
                        totals: gettextCatalog.getString('Totals'),
                    },
                },
            };

            return options;
        }
    }
})();
