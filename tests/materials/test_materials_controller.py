def test_slamd_selects_powder(client):
    response = client.get("/materials/powder")

    assert response.status_code == 200
    assert 'FeO' in response.json['template']


def test_slamd_selects_liquid(client):
    response = client.get("/materials/liquid")

    assert response.status_code == 200
    assert 'Precursor' in response.json['template']


def test_slamd_selects_aggregates(client):
    response = client.get("/materials/aggregates")

    assert response.status_code == 200
    template = response.json['template']
    assert 'Fine Aggregates' in template
    assert 'Coarse Aggregates' in template
    assert 'Type' in template
    assert 'Grading Curve' in template


def test_slamd_selects_process(client):
    response = client.get("/materials/process")

    template = response.json['template']
    assert response.status_code == 200
    assert 'Duration' in template
    assert 'Temperature' in template
    assert 'Relative Humidity' in template
