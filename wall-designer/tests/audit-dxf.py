import json
from pathlib import Path
import ezdxf
from ezdxf.lldxf.encoding import decode_dxf_unicode

root = Path(__file__).resolve().parent
expected = {f"audit-{x['type']}-{x['mode']}.dxf": x for x in json.loads((root/'geometry-audit.json').read_text(encoding='utf-8'))['summaries']}
results = []
for name, entry in expected.items():
    try:
        doc = ezdxf.readfile(root/name)
        auditor = doc.audit()
        assert not auditor.errors, [(e.code,e.message) for e in auditor.errors]
        assert not auditor.fixes, [(e.code,e.message) for e in auditor.fixes]
        entities = list(doc.modelspace())
        layers = {e.dxf.layer for e in entities}
        assert doc.header['$INSUNITS'] == 6
        assert layers == {'WALL', 'BASE', 'TERRAIN', 'DIM', 'LABEL'}, layers
        wall = [e for e in entities if e.dxf.layer == 'WALL']
        base = [e for e in entities if e.dxf.layer == 'BASE']
        assert len(wall) == len(base) == 4
        for ring, lines in [(entry['body'], wall), (entry['base'], base)]:
            for i, line in enumerate(lines):
                assert tuple(line.dxf.start) == (*ring[i], 0)
                assert tuple(line.dxf.end) == (*ring[(i+1)%4], 0)
        assert all(e.dxf.start.z == 0 and e.dxf.end.z == 0 for e in entities if e.dxftype() == 'LINE')
        assert all(e.dxf.style == 'STANDARD' for e in entities if e.dxftype() == 'TEXT')
        texts = [e.dxf.text for e in entities if e.dxftype() == 'TEXT']
        assert any('基础总宽' in decode_dxf_unicode(x) for x in texts)
        results.append({'file': name, 'pass': True, 'version': doc.dxfversion, 'units': doc.header['$INSUNITS'], 'entities': len(entities), 'layers': sorted(layers), 'audit_errors': [{'code':e.code,'message':e.message} for e in auditor.errors], 'audit_fixes': [{'code':e.code,'message':e.message} for e in auditor.fixes]})
    except Exception as e:
        results.append({'file': name, 'pass':False, 'error': f'{type(e).__name__}: {e}'})
out={'results':results,'passed':sum(x['pass'] for x in results),'failed':sum(not x['pass'] for x in results)}
(root/'dxf-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
raise SystemExit(int(bool(out['failed'])))
