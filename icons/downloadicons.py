import requests

for i in range(100):
    r = requests.get('https://www.hko.gov.hk/images/HKOWxIconOutline/pic{}.png'.format(i))
    if r.status_code == 200:
        open(str(i)+'.png', 'wb').write(r.content)
